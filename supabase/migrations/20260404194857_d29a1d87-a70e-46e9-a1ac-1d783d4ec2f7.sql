
-- 2. Create recruiter_profiles table
CREATE TABLE public.recruiter_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  company_logo_url TEXT,
  website TEXT,
  description TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view own profile" ON public.recruiter_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Recruiters can update own profile" ON public.recruiter_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Recruiters can insert own profile" ON public.recruiter_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all recruiter profiles" ON public.recruiter_profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all recruiter profiles" ON public.recruiter_profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view recruiter profiles" ON public.recruiter_profiles FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_recruiter_profiles_updated_at BEFORE UPDATE ON public.recruiter_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add recruiter_id to jobs table
ALTER TABLE public.jobs ADD COLUMN recruiter_id UUID;

CREATE POLICY "Recruiters can insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = recruiter_id AND has_role(auth.uid(), 'recruiter'));
CREATE POLICY "Recruiters can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = recruiter_id AND has_role(auth.uid(), 'recruiter'));
CREATE POLICY "Recruiters can delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = recruiter_id AND has_role(auth.uid(), 'recruiter'));
CREATE POLICY "Recruiters can view own jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = recruiter_id);

-- 4. Create application_questions table
CREATE TABLE public.application_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view questions" ON public.application_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recruiters can manage own job questions" ON public.application_questions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND recruiter_id = auth.uid()));
CREATE POLICY "Recruiters can update own job questions" ON public.application_questions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND recruiter_id = auth.uid()));
CREATE POLICY "Recruiters can delete own job questions" ON public.application_questions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND recruiter_id = auth.uid()));
CREATE POLICY "Admins can manage all questions" ON public.application_questions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 5. Create application_answers table
CREATE TABLE public.application_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.application_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own answers" ON public.application_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.job_applications WHERE id = application_id AND user_id = auth.uid()));
CREATE POLICY "Users can view own answers" ON public.application_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.job_applications WHERE id = application_id AND user_id = auth.uid()));
CREATE POLICY "Recruiters can view answers to their jobs" ON public.application_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.job_applications ja JOIN public.jobs j ON ja.job_id = j.id WHERE ja.id = application_id AND j.recruiter_id = auth.uid()));
CREATE POLICY "Admins can view all answers" ON public.application_answers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 6. Create candidate_notes table
CREATE TABLE public.candidate_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can manage own notes" ON public.candidate_notes FOR ALL TO authenticated USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);
CREATE POLICY "Candidates can view public notes about them" ON public.candidate_notes FOR SELECT TO authenticated USING (auth.uid() = candidate_id AND is_private = false);
CREATE POLICY "Admins can view all notes" ON public.candidate_notes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_candidate_notes_updated_at BEFORE UPDATE ON public.candidate_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can update own received messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);
CREATE POLICY "Admins can view all messages" ON public.messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 8. Recruiters can update applications to their jobs
CREATE POLICY "Recruiters can update applications to their jobs" ON public.job_applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND recruiter_id = auth.uid()));

-- 9. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user');
  
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  IF _role = 'recruiter' THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;
  
  RETURN NEW;
END;
$$;
