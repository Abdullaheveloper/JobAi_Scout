const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY missing");

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

    // Read the file as base64
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const CHUNK_SIZE = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    // Determine audio format from mime type
    let audioFormat = "webm";
    if (mime.includes("wav")) audioFormat = "wav";
    else if (mime.includes("mp3") || mime.includes("mpeg")) audioFormat = "mp3";
    else if (mime.includes("ogg")) audioFormat = "ogg";
    else if (mime.includes("flac")) audioFormat = "flac";
    else if (mime.includes("mp4") || mime.includes("m4a")) audioFormat = "mp4";

    // Use OpenRouter Whisper API for transcription
    const resp = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/whisper-large-v3-turbo",
        input_audio: {
          data: base64Audio,
          format: audioFormat,
        },
        ...(languageHint ? { language: languageHint } : {}),
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("OpenRouter Whisper error:", resp.status, txt);
      return new Response(JSON.stringify({ error: `STT failed: ${resp.status} ${txt}` }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resp.json();
    const text = result.text || "";

    return new Response(JSON.stringify({ text, language: languageHint || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-transcribe error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
