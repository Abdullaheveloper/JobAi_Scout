-- Add audio_url to voice_messages table
ALTER TABLE public.voice_messages ADD COLUMN IF NOT EXISTS audio_url text;

-- Create a storage bucket for voice audio if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice_audio', 'voice_audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies to allow public access to voice_audio
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice_audio');

CREATE POLICY "Authenticated Users Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice_audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Users Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'voice_audio' AND auth.role() = 'authenticated');
