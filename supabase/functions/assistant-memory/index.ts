import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();

    if (body.operation === "new_session") {
      const { data, error } = await client.from("assistant_sessions").insert({ user_id: user.id, title: typeof body.title === "string" ? body.title.slice(0, 80) : null }).select("*").single();
      if (error) throw error;
      return json({ session: data });
    }

    if (body.operation === "append") {
      const sessionId = String(body.session_id || "");
      const role = String(body.role || "");
      if (!sessionId || !["user", "assistant", "tool"].includes(role) || typeof body.content !== "string") return json({ error: "Invalid message" }, 400);
      const { error } = await client.from("conversation_messages").insert({ user_id: user.id, session_id: sessionId, role, content: body.content.slice(0, 50000), linked_tool_call: body.linked_tool_call || null });
      if (error) throw error;
      if (role === "user") {
        const title = body.content.trim().replace(/\s+/g, " ").slice(0, 60);
        if (title) await client.from("assistant_sessions").update({ title }).eq("id", sessionId).eq("user_id", user.id).is("title", null);
      }
      await client.from("assistant_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", user.id);
      return json({ saved: true });
    }

    if (body.operation === "session_messages") {
      const sessionId = String(body.session_id || "");
      if (!sessionId) return json({ error: "A session is required" }, 400);
      const { data: ownedSession, error: sessionError } = await client.from("assistant_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
      if (sessionError) throw sessionError;
      if (!ownedSession) return json({ error: "Chat not found" }, 404);
      const { data: messages, error } = await client.from("conversation_messages").select("*").eq("session_id", sessionId).eq("user_id", user.id).order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return json({ messages: messages || [] });
    }

    if (body.operation === "bootstrap") {
      const { data: sessions, error: sessionsError } = await client.from("assistant_sessions").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
      if (sessionsError) throw sessionsError;
      const active = sessions?.[0] || null;
      const sessionIds = (sessions || []).map((session) => session.id);
      const [messages, memory, actions] = await Promise.all([
        sessionIds.length ? client.from("conversation_messages").select("*").in("session_id", sessionIds).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
        client.from("user_profile_memory").select("memory_key,memory_value,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
        client.from("action_history").select("action_type,params,result,created_at,session_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (messages.error || memory.error || actions.error) throw messages.error || memory.error || actions.error;
      return json({ sessions: sessions || [], active_session: active, messages: messages.data || [], profile_memory: memory.data || [], actions: actions.data || [] });
    }
    return json({ error: "Unknown operation" }, 400);
  } catch (error) {
    console.error("assistant-memory error", error);
    return json({ error: error instanceof Error ? error.message : "Memory request failed" }, 500);
  }
});
