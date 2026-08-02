export const ASSISTANT_INPUT_TOKEN_LIMIT = 900_000;
export const ASSISTANT_OUTPUT_TOKEN_LIMIT = 60_000;
export const ASSISTANT_LIMIT_WARNING_RATIO = 0.9;

export function assistantSessionLimitState(inputTokens: number, outputTokens: number) {
  const reached = inputTokens >= ASSISTANT_INPUT_TOKEN_LIMIT || outputTokens >= ASSISTANT_OUTPUT_TOKEN_LIMIT;
  const near = reached || inputTokens >= ASSISTANT_INPUT_TOKEN_LIMIT * ASSISTANT_LIMIT_WARNING_RATIO || outputTokens >= ASSISTANT_OUTPUT_TOKEN_LIMIT * ASSISTANT_LIMIT_WARNING_RATIO;
  return { reached, near };
}
