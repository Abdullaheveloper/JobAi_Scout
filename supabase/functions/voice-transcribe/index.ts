import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Language code mapping for Whisper API
const LANG_MAP: Record<string, string> = {
  en: "en", ur: "ur", ar: "ar", hi: "hi", fr: "fr", de: "de",
  english: "en", urdu: "ur", arabic: "ar", hindi: "hi", french: "fr", german: "de",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const form = await req.formData();
    const file = form.get("file");
    const languageHint = (form.get("language") as string) || "";
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "file required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blob = file as Blob;
    const mime = (blob.type || "audio/webm").split(";")[0];
    const ext = ({ "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" } as Record<string, string>)[mime] || "webm";

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", blob, `recording.${ext}`);

    // Whisper supports language hint for better accuracy
    const langCode = LANG_MAP[languageHint.toLowerCase()] || languageHint || "";
    if (langCode) {
      upstream.append("language", langCode);
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: `STT failed: ${resp.status} ${txt}` }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await resp.json();
    return new Response(JSON.stringify({ text: json.text || "", language: langCode || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-transcribe error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});