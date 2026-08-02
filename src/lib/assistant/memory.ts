import { supabase } from "@/integrations/supabase/client";

export type AssistantSession = { id: string; title: string | null; input_tokens: number; output_tokens: number; started_at: string; updated_at: string };
export type StoredMessage = { id: string; session_id: string; role: "user" | "assistant" | "tool"; content: string; linked_tool_call: Record<string, unknown> | null; created_at: string };
export type ProfileMemory = { memory_key: string; memory_value: unknown; updated_at: string };
export type ActionMemory = { action_type: string; params: Record<string, unknown>; result: Record<string, unknown>; created_at: string; session_id: string | null };
export type MemoryBootstrap = { sessions: AssistantSession[]; active_session: AssistantSession | null; messages: StoredMessage[]; profile_memory: ProfileMemory[]; actions: ActionMemory[] };

const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in to use assistant memory.");
  let response: Response;
  try {
    response = await fetch(`${functionsUrl}/assistant-memory`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: apiKey }, body: JSON.stringify(body) });
  } catch {
    throw new Error("The network dropped while accessing assistant memory. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Assistant memory could not be loaded.");
  return data as T;
}

export const loadAssistantMemory = () => request<MemoryBootstrap>({ operation: "bootstrap" });
export const createAssistantSession = (title?: string) => request<{ session: AssistantSession }>({ operation: "new_session", title });
export const appendAssistantMessage = (sessionId: string, role: "user" | "assistant" | "tool", content: string, linkedToolCall?: Record<string, unknown>) => request<{ saved: true }>({ operation: "append", session_id: sessionId, role, content, linked_tool_call: linkedToolCall });

export function compactMemoryContext(memory: MemoryBootstrap | null, currentSessionId: string) {
  if (!memory) return {};
  const facts = Object.fromEntries(memory.profile_memory.map((item) => [item.memory_key, item.memory_value]));
  const recentPriorMessages = memory.messages.filter((message) => message.session_id !== currentSessionId).slice(0, 8).reverse().map(({ role, content }) => ({ role, content: content.slice(0, 600) }));
  const recentActions = memory.actions.slice(0, 8).map(({ action_type, result, created_at }) => ({ action_type, result, created_at }));
  return { profile_memory: facts, recent_prior_messages: recentPriorMessages, recent_actions: recentActions };
}
