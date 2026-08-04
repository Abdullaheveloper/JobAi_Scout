-- Enum changes must commit before the values are used by the next migration.
ALTER TYPE public.usage_feature ADD VALUE IF NOT EXISTS 'chat_bot';
ALTER TYPE public.usage_feature ADD VALUE IF NOT EXISTS 'voice_bot';
ALTER TYPE public.usage_period ADD VALUE IF NOT EXISTS 'week';
