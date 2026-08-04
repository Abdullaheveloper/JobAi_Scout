-- Make every feature use resettable calendar/manual counters while retaining
-- feature_usage_log as immutable history.
CREATE OR REPLACE FUNCTION public.reset_metered_usage(p_user uuid,p_feature public.usage_feature DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; l_key text;
BEGIN
 FOR r IN
   SELECT f.key AS feature,coalesce(u.reset_period,g.reset_period,'fresh') reset_period,
          coalesce(u.period,g.period,'day') period
   FROM usage_features f
   LEFT JOIN feature_usage_limits u ON u.feature=f.key AND u.user_id=p_user
   LEFT JOIN feature_usage_limits g ON g.feature=f.key AND g.user_id IS NULL
   WHERE f.enabled AND (p_feature IS NULL OR f.key=p_feature)
 LOOP
   l_key:=usage_period_key(r.reset_period,r.period,now());
   INSERT INTO usage_counters(user_id,feature,period_key,used) VALUES(p_user,r.feature,l_key,0)
   ON CONFLICT(user_id,feature,period_key) DO UPDATE SET used=0,updated_at=now();
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_and_record_feature_usage(
 p_user_id uuid,p_feature public.usage_feature,p_record boolean DEFAULT true,p_now timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb; l_key text;
BEGIN
 q:=consume_metered_usage(p_user_id,p_feature,1,p_now);
 l_key:=q->>'periodKey';
 IF coalesce((q->>'allowed')::boolean,false) AND NOT p_record AND l_key IS NOT NULL AND q->'limit' <> 'null'::jsonb THEN
   PERFORM refund_metered_usage(p_user_id,p_feature,1,l_key);
 END IF;
 IF coalesce((q->>'allowed')::boolean,false) AND p_record THEN
   INSERT INTO feature_usage_log(user_id,feature,created_at) VALUES(p_user_id,p_feature,p_now);
 END IF;
 RETURN jsonb_build_object('allowed',coalesce((q->>'allowed')::boolean,false),'used',coalesce((q->>'used')::integer,0),
   'source',CASE WHEN coalesce((q->>'isOverride')::boolean,false) THEN 'user' ELSE 'global' END,
   'maxCount',q->'limit','period',coalesce(q->>'period','day'),'resetPeriod',coalesce(q->>'resetPeriod','fresh'),
   'resetsAt',NULL,'message',q->>'message');
END $$;
