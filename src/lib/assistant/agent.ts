import { supabase } from "@/integrations/supabase/client";
import { assistantToolDefinitions, executeAssistantTool, type AssistantScreenContext, type ConfirmationDecision, type ConfirmationRequest, type ToolExecutionResult } from "./tools";
import type { NavigateFunction } from "react-router-dom";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  statuses?: string[];
  live?: boolean;
  interrupted?: boolean;
};

type LlmMessage = {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type AgentResponse = { message: LlmMessage; usage?: { input_tokens: number; output_tokens: number; near_limit: boolean }; code?: string };

const MAX_TOOL_ROUNDS = 8;
const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function parseArguments(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error("The assistant returned invalid tool arguments.");
  }
}

export async function runAssistantTurn(args: {
  history: AssistantMessage[];
  screen: AssistantScreenContext;
  navigate: NavigateFunction;
  signal: AbortSignal;
  onToolResult: (result: ToolExecutionResult) => void;
  requestConfirmation: (request: ConfirmationRequest) => Promise<ConfirmationDecision>;
  sessionId: string;
  memoryContext: Record<string, unknown>;
  onUsage: (usage: { input_tokens: number; output_tokens: number; near_limit: boolean }) => void;
  onToolError?: (message: string) => void;
}) {
  const messages: LlmMessage[] = args.history.slice(-12).map((message) => ({ role: message.role, content: message.content }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Please sign in to use the assistant.");
    let response: Response;
    try {
      response = await fetch(`${functionsUrl}/assistant-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: apiKey },
        body: JSON.stringify({ messages, screen_state: args.screen, tools: assistantToolDefinitions, session_id: args.sessionId, memory_context: args.memoryContext }),
        signal: args.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error("The network dropped mid-response. Check your connection and try again.");
    }
    const data = await response.json() as AgentResponse & { error?: string };
    if (!response.ok) {
      const error = new Error(data.error || (response.status === 0 ? "The network dropped mid-response. Check your connection and try again." : `Assistant request failed (${response.status})`));
      if (data.code) (error as Error & { code?: string }).code = data.code;
      throw error;
    }
    if (data.usage) args.onUsage(data.usage);
    if (!data?.message) throw new Error("The assistant returned an empty response.");

    const assistantMessage = data.message;
    messages.push(assistantMessage);
    const calls = assistantMessage.tool_calls || [];
    if (calls.length === 0) return assistantMessage.content?.trim() || "Done.";

    for (const call of calls) {
      try {
        const execution = await executeAssistantTool(call.function.name, parseArguments(call.function.arguments), {
          ...args.screen,
          navigate: args.navigate,
          signal: args.signal,
          requestConfirmation: args.requestConfirmation,
          session_id: args.sessionId,
        });
        args.onToolResult({ ...execution, linked_tool_call: { name: call.function.name, params: parseArguments(call.function.arguments) } });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(execution.result) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed";
        args.onToolError?.(message);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: message }) });
      }
    }
  }

  throw new Error("The assistant used too many tool steps. Please try a simpler request.");
}
