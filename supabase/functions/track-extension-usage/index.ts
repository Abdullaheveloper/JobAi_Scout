import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { enforceUsageLimit } from "../_shared/usage-limits.ts";



const corsHeaders = {

  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods": "POST, OPTIONS",

};



const json = (body: Record<string, unknown>, status = 200) =>

  new Response(JSON.stringify(body), {

    status,

    headers: { ...corsHeaders, "Content-Type": "application/json" },

  });



Deno.serve(async (req) => {

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });



  try {

    const { email, fields, page_url, event_id, phase } = await req.json();

    const safeFields: string[] = Array.isArray(fields)

      ? fields.filter((f) => typeof f === "string").slice(0, 50)

      : [];

    const safeEmail = typeof email === "string" ? email.trim().toLowerCase() : null;



    const supabase = createClient(

      Deno.env.get("SUPABASE_URL")!,

      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,

    );



    let user_id: string | null = null;



    // Prefer Authorization (extension JWT) — required for quota enforcement.

    const authHeader = req.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {

      const userClient = createClient(

        Deno.env.get("SUPABASE_URL")!,

        Deno.env.get("SUPABASE_ANON_KEY")!,

        { global: { headers: { Authorization: authHeader } } },

      );

      const { data: { user } } = await userClient.auth.getUser();

      if (user?.id) user_id = user.id;

    }



    if (!user_id && safeEmail) {

      const { data: prof } = await supabase

        .from("profiles")

        .select("user_id")

        .ilike("email", safeEmail)

        .maybeSingle();

      user_id = prof?.user_id ?? null;

    }



    if (!user_id) {

      return json({ error: "Sign in to JobAI Scout before using Form Fill." }, 401);

    }

    if (phase === "complete") {

      if (typeof event_id !== "string" || !event_id) return json({ error: "A fill event ID is required." }, 400);

      const { data, error } = await supabase

        .from("extension_usage")

        .update({ fields: safeFields, field_count: safeFields.length, completed_at: new Date().toISOString() })

        .eq("id", event_id)

        .eq("user_id", user_id)

        .select("id,field_count")

        .maybeSingle();

      if (error) throw error;

      if (!data) return json({ error: "Fill event was not found." }, 404);

      return json({ ok: true, event_id: data.id, field_count: data.field_count });

    }



    // One feature_usage_log row per fill *attempt* (user-initiated fill).

    // Counted here — not on extension-profile — so profile load does not consume quota.

    const usage = await enforceUsageLimit(supabase, user_id, "form_fill", { record: true });

    if (!usage.allowed) {

      return json(usage.body, usage.status);

    }



    const { data: event, error } = await supabase.from("extension_usage").insert({

      user_id,

      email: safeEmail,

      fields: safeFields,

      field_count: safeFields.length,

      page_url: typeof page_url === "string" ? page_url.slice(0, 500) : null,

    }).select("id").single();

    if (error) throw error;



    return json({ ok: true, event_id: event.id });

  } catch (e) {

    console.error("track-extension-usage error:", e);

    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);

  }

});

