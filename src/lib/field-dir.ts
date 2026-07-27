/**
 * Resolve writing direction for form fields.
 * Sentence-like placeholders use `auto` so punctuation follows content;
 * URL / email / tel stay LTR.
 */
export type FieldDir = "ltr" | "rtl" | "auto" | undefined;

const LTR_INPUT_TYPES = new Set(["email", "url", "tel"]);

export function resolveFieldDir(
  type?: string,
  explicitDir?: FieldDir,
): NonNullable<FieldDir> {
  if (explicitDir === "ltr" || explicitDir === "rtl" || explicitDir === "auto") {
    return explicitDir;
  }
  if (type && LTR_INPUT_TYPES.has(type)) return "ltr";
  return "auto";
}
