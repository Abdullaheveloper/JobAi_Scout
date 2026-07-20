-- Private applicant images used only when the user explicitly uploads one.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-assets',
  'profile-assets',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own profile assets') THEN
    CREATE POLICY "Users can upload own profile assets"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'profile-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own profile assets') THEN
    CREATE POLICY "Users can view own profile assets"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'profile-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own profile assets') THEN
    CREATE POLICY "Users can update own profile assets"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'profile-assets' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'profile-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own profile assets') THEN
    CREATE POLICY "Users can delete own profile assets"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'profile-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
