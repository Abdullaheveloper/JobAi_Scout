CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _full_name text;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user');
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    ''
  );

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, _full_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  IF _role = 'recruiter' THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;

  RETURN NEW;
END;
$$;
