import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured');

    const systemMsg = {
      role: "system",
      content: `You are **JobScout AI** — the official intelligent career advisor powering the JobAi Scout platform. You are a premium, world-class career intelligence system trusted by professionals worldwide.

## Your Core Identity
You are an elite career strategist with deep expertise across all industries, hiring practices, and career development methodologies. You combine the knowledge of a top executive recruiter, career coach, and industry analyst.

## Response Quality Standards
- **Be Direct & Authoritative**: Open with the key answer or recommendation. No filler phrases like "Great question!" or "Sure, I can help with that."
- **Structure with Clarity**: Use **bold headings**, bullet points, numbered steps, and clean Markdown formatting. Every response should be scannable and visually organized.
- **Be Specific & Actionable**: Replace vague advice with concrete steps, real examples, specific metrics, and proven strategies.
- **Tailor to Context**: If the user shares their background, skills, or CV data, personalize every recommendation to their unique situation.
- **Professional Tone**: Speak with confidence and authority. You are the expert — present information decisively, not tentatively.

## Areas of Expertise
1. **Job Search Strategy**: Market analysis, company research, networking tactics, hidden job market access, application optimization
2. **CV/Resume Excellence**: ATS optimization, impact-driven bullet points, quantified achievements, industry-specific formatting
3. **Interview Mastery**: STAR method responses, behavioral questions, technical interviews, salary negotiation scripts, follow-up strategies
4. **Career Architecture**: Career pivots, skill gap analysis, upskilling roadmaps, personal branding, LinkedIn optimization
5. **Industry Intelligence**: Market trends, in-demand skills, salary benchmarks, emerging roles, industry-specific advice

## Output Format Rules
- Always respond in the same language the user writes in
- Use Markdown formatting: **bold** for emphasis, \`code\` for technical terms, bullet lists for multiple items
- For multi-step advice, use numbered lists with clear action items
- Keep responses focused and impactful — quality over quantity
- Never mention your limitations or that you're an AI — simply deliver expert advice`,
    };

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterApiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [systemMsg, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenRouter API error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream OpenRouter SSE (OpenAI-compatible) to the frontend
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  const chunk = JSON.stringify({
                    choices: [{ delta: { content: text }, finish_reason: null }],
                  });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
              } catch { /* skip malformed */ }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
