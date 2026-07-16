const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

function wav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const out = new Uint8Array(44 + pcm.length); const view = new DataView(out.buffer); const write = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.length, true); write(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, pcm.length, true); out.set(pcm, 44); return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY"); if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on Supabase.");
    const { text, voice = "Kore" } = await req.json(); if (typeof text !== "string" || !text.trim() || text.length > 15000) throw new Error("Text is required and must be under 15,000 characters.");
    const geminiVoice = ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"].includes(voice) ? voice : "Kore";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ model: "gemini-2.5-flash-preview-tts", input: `Read the following naturally and clearly:\n${text}`, response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: geminiVoice }] } }) });
    if (!response.ok) throw new Error(`Gemini TTS failed (${response.status}): ${await response.text()}`);
    const data = await response.json(); const audio = data.output_audio?.data; if (!audio) throw new Error("Gemini returned no audio");
    const binary = atob(audio); const pcm = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Response(wav(pcm), { headers: { ...corsHeaders, "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (error) { console.error("voice-tts", error); return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "TTS failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
