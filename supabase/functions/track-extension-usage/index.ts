import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, fields, page_url } = await req.json();
    const safeFields: string[] = Array.isArray(fields)
      ? fields.filter((f) => typeof f === "string").slice(0, 50)
      : [];
    const safeEmail = typeof email === "string" ? email.trim().toLowerCase() : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let user_id: string | null = null;
    if (safeEmail) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("email", safeEmail)
        .maybeSingle();
      user_id = prof?.user_id ?? null;
    }

    const { error } = await supabase.from("extension_usage").insert({
      user_id,
      email: safeEmail,
      fields: safeFields,
      field_count: safeFields.length,
      page_url: typeof page_url === "string" ? page_url.slice(0, 500) : null,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-extension-usage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});