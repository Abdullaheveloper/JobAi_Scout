
CREATE TABLE public.extension_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  fields text[] NOT NULL DEFAULT '{}',
  field_count integer NOT NULL DEFAULT 0,
  page_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_extension_usage_email ON public.extension_usage(email);
CREATE INDEX idx_extension_usage_created_at ON public.extension_usage(created_at DESC);

ALTER TABLE public.extension_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all extension usage"
ON public.extension_usage FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own extension usage"
ON public.extension_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
