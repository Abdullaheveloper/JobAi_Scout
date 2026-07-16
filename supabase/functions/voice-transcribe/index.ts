const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");
    const form = await req.formData();
    const file = form.get("file");
    const language = (form.get("language") as string) || "";
    if (!(file instanceof File) && !(file instanceof Blob)) throw new Error("file required");
    const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const response = await fetch(GEMINI_URL, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Transcribe this audio exactly. Return only the spoken words.${language ? ` The expected language is ${language}.` : ""}` }, { inline_data: { mime_type: (file as Blob).type || "audio/webm", data: btoa(binary) } }] }], generationConfig: { temperature: 0 } }),
    });
    if (!response.ok) throw new Error(`Gemini transcription failed (${response.status}): ${await response.text()}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim() || "";
    return new Response(JSON.stringify({ text, language: language || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("voice-transcribe", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Transcription failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
