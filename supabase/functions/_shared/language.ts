// Lightweight language detection from text patterns — shared by voice-chat
// and voice-agent-llm so both cache/log entries carry a real language code.
export function detectLanguage(text: string): string {
  const arabicRe = /[؀-ۿݐ-ݿ]/;
  const devanagariRe = /[ऀ-ॿ]/;
  const frenchRe = /\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|est|sont|avoir|être|dans|pour|avec|sur|pas|que|qui|ce|cette)\b/i;
  const germanRe = /\b(ich|du|er|sie|es|wir|ihr|ist|sind|haben|sein|und|oder|aber|für|mit|von|zu|auf|in|der|die|das|ein|eine)\b/i;

  const arabicCount = (text.match(arabicRe) || []).length;
  const devanagariCount = (text.match(devanagariRe) || []).length;
  const frenchCount = (text.match(frenchRe) || []).length;
  const germanCount = (text.match(germanRe) || []).length;

  if (arabicCount > text.length * 0.3) return "ar";
  if (devanagariCount > text.length * 0.2) return "hi";
  if (frenchCount > 3) return "fr";
  if (germanCount > 3) return "de";
  if (arabicCount > 0 && /[ٹڈڑںھہیے]/.test(text)) return "ur";
  return "en";
}
