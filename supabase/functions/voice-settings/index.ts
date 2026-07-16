import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const method = req.method;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // GET: Fetch settings (global + user preferences or admin stats)
    if (method === "GET") {
      if (action === "stats") {
        const { data, error } = await supabase.rpc("get_voice_admin_stats");
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get global settings
      const { data: globalSettings } = await adminSupabase
        .from("voice_settings")
        .select("*")
        .is("user_id", null)
        .maybeSingle();

      // Get user preferences
      const { data: userSettings } = await supabase
        .from("voice_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(JSON.stringify({
        global: globalSettings || {
          assistant_enabled: true,
          silence_timeout: 2,
          confidence_threshold: 0.70,
          supported_languages: ["en", "ur", "ar", "hi", "fr", "de"],
          default_personality: "professional",
          default_speed: 1.0,
        },
        user: userSettings || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Update settings
    if (method === "POST") {
      const body = await req.json();
      const { data: userRoleData } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" as never });
      const isAdmin = userRoleData === true;

      if (action === "global") {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update global settings
        const { data: existing } = await adminSupabase
          .from("voice_settings")
          .select("id")
          .is("user_id", null)
          .maybeSingle();

        const updates: Record<string, unknown> = {};
        if (body.assistant_enabled !== undefined) updates.assistant_enabled = body.assistant_enabled;
        if (body.silence_timeout !== undefined) updates.silence_timeout = Math.max(1, Math.min(5, body.silence_timeout));
        if (body.confidence_threshold !== undefined) updates.confidence_threshold = Math.max(0, Math.min(1, body.confidence_threshold));
        if (body.supported_languages) updates.supported_languages = body.supported_languages;
        if (body.default_personality) updates.default_personality = body.default_personality;
        if (body.default_speed !== undefined) updates.default_speed = body.default_speed;

        if (existing) {
          await adminSupabase.from("voice_settings").update(updates).eq("id", existing.id);
        } else {
          await adminSupabase.from("voice_settings").insert({ user_id: null, ...updates });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Update user preferences
        const { data: existing } = await supabase
          .from("voice_settings")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        const updates: Record<string, unknown> = { user_id: userId };
        if (body.preferred_language !== undefined) updates.preferred_language = body.preferred_language;
        if (body.preferred_personality !== undefined) updates.preferred_personality = body.preferred_personality;
        if (body.preferred_speed !== undefined) updates.preferred_speed = body.preferred_speed;
        if (body.preferred_voice_id !== undefined) updates.preferred_voice_id = body.preferred_voice_id;

        if (existing) {
          await supabase.from("voice_settings").update(updates).eq("id", existing.id);
        } else {
          await supabase.from("voice_settings").insert(updates);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-settings error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
