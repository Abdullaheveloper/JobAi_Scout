import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now/gi,
  /system\s*prompt/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/gi,
  /disregard\s+(all\s+)?prior/gi,
  /forget\s+(all\s+)?instructions/gi,
  /new\s+instructions?:/gi,
  /act\s+as\s+if\s+you\s+are/gi,
  /pretend\s+you\s+are/gi,
  /override\s+(your\s+)?instructions/gi,
];

// PII detection patterns
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: "email" },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: "phone" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: "ssn" },
  { pattern: /\b\d{16}\b/, type: "credit_card" },
];

// Other-user data request patterns
const OTHER_USER_PATTERNS = [
  /other\s+users?/gi,
  /someone\s+else/gi,
  /another\s+person/gi,
  /show\s+me\s+(other|someone)/gi,
  /what('s| is)\s+\w+\s+(email|phone|resume|cv)/gi,
  /tell\s+me\s+about\s+\w+\s+(profile|account)/gi,
  /access\s+(other|another)/gi,
];

// Off-topic keywords (minimal check)
const CAREER_KEYWORDS = [
  "job", "career", "cv", "resume", "interview", "salary", "hiring", "recruit",
  "apply", "application", "position", "role", "skill", "experience", "education",
  "work", "employ", "company", "workplace", "professional", "qualify",
  "cover letter", "portfolio", "linkedin", "indeed", "glassdoor",
  "upload", "profile", "dashboard", "agent", "assistant", "help",
  "hello", "hi", "hey", "thanks", "thank", "please", "how", "what", "why",
  "can you", "could you", "tell me", "explain", "guide", "tutorial",
];

function sanitizeInput(text: string): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized.trim();
}

function detectPII(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, type } of PII_PATTERNS) {
    if (pattern.test(text)) found.push(type);
  }
  return found;
}

function isOtherUserDataRequest(text: string): boolean {
  return OTHER_USER_PATTERNS.some((p) => p.test(text));
}

function isOffTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return !CAREER_KEYWORDS.some((kw) => lower.includes(kw));
}

function isSystemInternalRequest(text: string): boolean {
  const patterns = [
    /system\s+prompt/gi,
    /api\s+key/gi,
    /database/gi,
    /credentials/gi,
    /architecture/gi,
    /infrastructure/gi,
    /internal/gi,
    /backend/gi,
    /server\s+side/gi,
    /env\s+variables?/gi,
  ];
  return patterns.some((p) => p.test(text));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });

    // Auth check
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { query, userId } = body;

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run checks
    const sanitizedQuery = sanitizeInput(query);
    const piiFound = detectPII(query);
    const otherUserRequest = isOtherUserDataRequest(query);
    const offTopic = isOffTopic(query);
    const systemInternal = isSystemInternalRequest(query);

    // Determine if blocked
    if (piiFound.length > 0) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Query contains sensitive data (${piiFound.join(", ")}). Please do not share personal information.`,
        sanitizedQuery,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (otherUserRequest) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "I can only access your own information. I cannot share other users' data.",
        sanitizedQuery,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (systemInternal) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "I'm designed to help with job searching and career advice.",
        sanitizedQuery,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (offTopic) {
      return new Response(JSON.stringify({
        allowed: true,
        reason: "redirect",
        sanitizedQuery,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      allowed: true,
      sanitizedQuery,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-agent-guard error:", e);
    return new Response(JSON.stringify({
      allowed: true,
      sanitizedQuery: "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
