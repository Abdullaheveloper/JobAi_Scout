-- Metered Scout Assistant quotas. Existing meters remain intact.

CREATE TABLE IF NOT EXISTS public.usage_features (
  key public.usage_feature PRIMARY KEY,
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('count','messages','minutes')),
  feature_group text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO public.usage_features(key,label,unit,feature_group,enabled,sort_order) VALUES
 ('job_scraping','Job Scraping','count','job_scraping',true,10),
 ('form_fill','Form Fill','count','form_fill',true,20),
 ('voice_assistant','Voice Assistant','count','voice_assistant',false,30),
 ('chat_bot','Chat Bot','messages','ai_assistant',true,31),
 ('voice_bot','Voice Bot','minutes','ai_assistant',true,32),
 ('automation','Automation','count','automation',true,40)
ON CONFLICT (key) DO UPDATE SET label=excluded.label,unit=excluded.unit,
 feature_group=excluded.feature_group,enabled=excluded.enabled,sort_order=excluded.sort_order;

ALTER TABLE public.feature_usage_limits ALTER COLUMN max_count DROP NOT NULL;
ALTER TABLE public.feature_usage_limits ADD COLUMN IF NOT EXISTS reset_period text NOT NULL DEFAULT 'fresh';
ALTER TABLE public.feature_usage_limits ADD COLUMN IF NOT EXISTS granted_at timestamptz;
ALTER TABLE public.feature_usage_limits DROP CONSTRAINT IF EXISTS feature_usage_limits_reset_period_check;
ALTER TABLE public.feature_usage_limits ADD CONSTRAINT feature_usage_limits_reset_period_check CHECK(reset_period IN ('fresh','none'));

INSERT INTO public.feature_usage_limits(user_id,feature,max_count,period,reset_period)
VALUES (NULL,'chat_bot',30,'day','fresh'),(NULL,'voice_bot',10,'day','fresh')
ON CONFLICT (feature) WHERE user_id IS NULL DO NOTHING;

-- Preserve old personal grants: one old voice session becomes ten chat messages.
INSERT INTO public.feature_usage_limits(user_id,feature,max_count,period,reset_period,updated_by,updated_at,granted_at)
SELECT user_id,'chat_bot',max_count * 10,'day','fresh',updated_by,updated_at,coalesce(granted_at,updated_at)
FROM public.feature_usage_limits WHERE feature='voice_assistant' AND user_id IS NOT NULL
ON CONFLICT (user_id,feature) WHERE user_id IS NOT NULL DO NOTHING;

CREATE TABLE IF NOT EXISTS public.usage_counters (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 feature public.usage_feature NOT NULL,
 period_key text NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK(used >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,feature,period_key)
);
CREATE TABLE IF NOT EXISTS public.usage_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 reset_timezone text NOT NULL DEFAULT 'Asia/Karachi'
);
INSERT INTO public.usage_settings(singleton,reset_timezone) VALUES(true,'Asia/Karachi') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.assistant_voice_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(), last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz, charged_minutes integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'active',
 CHECK(status IN ('active','ended','expired'))
);

CREATE OR REPLACE FUNCTION public.usage_period_key(p_reset text, p_period public.usage_period DEFAULT 'day', p_now timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p_reset='none' THEN 'total'
   WHEN p_period='week' THEN to_char(date_trunc('week',p_now AT TIME ZONE (SELECT reset_timezone FROM usage_settings WHERE singleton)),'IYYY-"W"IW')
   ELSE to_char(p_now AT TIME ZONE (SELECT reset_timezone FROM usage_settings WHERE singleton),'YYYY-MM-DD') END
$$;

CREATE OR REPLACE FUNCTION public.consume_metered_usage(p_user uuid,p_feature public.usage_feature,p_amount integer DEFAULT 1,p_now timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l_limit integer; l_reset text; l_period public.usage_period; l_override boolean; l_key text; l_used integer; l_unit text; l_label text;
BEGIN
 IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
 SELECT coalesce(u.max_count,g.max_count),coalesce(u.reset_period,'fresh'),coalesce(u.period,g.period,'day'),u.id IS NOT NULL,f.unit,f.label
 INTO l_limit,l_reset,l_period,l_override,l_unit,l_label FROM usage_features f
 LEFT JOIN feature_usage_limits u ON u.feature=f.key AND u.user_id=p_user
 LEFT JOIN feature_usage_limits g ON g.feature=f.key AND g.user_id IS NULL WHERE f.key=p_feature AND f.enabled;
 IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'message','This feature is turned off for your account. Contact your admin to enable it.'); END IF;
 l_key:=usage_period_key(l_reset,l_period,p_now);
 IF l_limit IS NULL THEN RETURN jsonb_build_object('allowed',true,'used',0,'limit',null,'remaining',null,'periodKey',l_key,'resetPeriod',l_reset,'period',l_period,'unit',l_unit); END IF;
 IF l_limit=0 THEN RETURN jsonb_build_object('allowed',false,'used',0,'limit',0,'remaining',0,'resetPeriod',l_reset,'unit',l_unit,'message','This feature is turned off for your account. Contact your admin to enable it.'); END IF;
 INSERT INTO usage_counters(user_id,feature,period_key,used) VALUES(p_user,p_feature,l_key,p_amount)
 ON CONFLICT(user_id,feature,period_key) DO UPDATE SET used=usage_counters.used+excluded.used,updated_at=now()
 WHERE usage_counters.used+excluded.used <= l_limit RETURNING used INTO l_used;
 IF l_used IS NULL THEN SELECT used INTO l_used FROM usage_counters WHERE user_id=p_user AND feature=p_feature AND period_key=l_key;
  RETURN jsonb_build_object('allowed',false,'used',coalesce(l_used,0),'limit',l_limit,'remaining',0,'resetPeriod',l_reset,'period',l_period,'unit',l_unit,'message',CASE WHEN l_reset='none' THEN 'Your No Fresh allowance is used up. Contact your admin for more.' WHEN l_period='week' THEN 'You have reached this week''s '||l_label||' limit. Try again next week.' ELSE 'You have reached today''s '||l_label||' limit. Try again tomorrow.' END); END IF;
 RETURN jsonb_build_object('allowed',true,'used',l_used,'limit',l_limit,'remaining',l_limit-l_used,'periodKey',l_key,'resetPeriod',l_reset,'period',l_period,'unit',l_unit,'isOverride',l_override);
END $$;

CREATE OR REPLACE FUNCTION public.refund_metered_usage(p_user uuid,p_feature public.usage_feature,p_amount integer,p_period_key text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE usage_counters SET used=greatest(0,used-p_amount),updated_at=now() WHERE user_id=p_user AND feature=p_feature AND period_key=p_period_key $$;

CREATE OR REPLACE FUNCTION public.reset_metered_usage(p_user uuid,p_feature public.usage_feature DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ DELETE FROM usage_counters WHERE user_id=p_user AND (p_feature IS NULL OR feature=p_feature) $$;

CREATE OR REPLACE FUNCTION public.set_metered_usage(p_user uuid,p_feature public.usage_feature,p_used integer,p_now timestamptz DEFAULT now()) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l_reset text; l_period public.usage_period; l_key text;
BEGIN
 IF p_used < 0 THEN RAISE EXCEPTION 'used must be non-negative'; END IF;
 SELECT coalesce(u.reset_period,g.reset_period,'fresh'),coalesce(u.period,g.period,'day') INTO l_reset,l_period
 FROM usage_features f LEFT JOIN feature_usage_limits u ON u.feature=f.key AND u.user_id=p_user
 LEFT JOIN feature_usage_limits g ON g.feature=f.key AND g.user_id IS NULL WHERE f.key=p_feature;
 l_key:=usage_period_key(l_reset,l_period,p_now);
 INSERT INTO usage_counters(user_id,feature,period_key,used) VALUES(p_user,p_feature,l_key,p_used)
 ON CONFLICT(user_id,feature,period_key) DO UPDATE SET used=excluded.used,updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.purge_old_usage_counters() RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH gone AS (DELETE FROM usage_counters WHERE period_key <> 'total' AND period_key < to_char((now()-interval '90 days') AT TIME ZONE (SELECT reset_timezone FROM usage_settings WHERE singleton),'YYYY-MM-DD') RETURNING 1) SELECT count(*) FROM gone
$$;
ALTER TABLE public.usage_features ENABLE ROW LEVEL SECURITY; ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY; ALTER TABLE public.assistant_voice_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.usage_features,public.usage_counters TO authenticated; GRANT ALL ON public.usage_features,public.usage_counters,public.assistant_voice_sessions TO service_role;
REVOKE ALL ON FUNCTION public.consume_metered_usage(uuid,public.usage_feature,integer,timestamptz) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.consume_metered_usage(uuid,public.usage_feature,integer,timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.set_metered_usage(uuid,public.usage_feature,integer,timestamptz) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.set_metered_usage(uuid,public.usage_feature,integer,timestamptz) TO service_role;
