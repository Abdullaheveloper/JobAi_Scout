import type { ClassifiedField, FillResult, UserProfile } from "../lib/types";
import { scanFields } from "./scanner";
import { classifyFields, filterClassified } from "./classifier";
import { fillField } from "./filler";

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 10_000;

export function setupObserver(profile: UserProfile): void {
  disconnectObserver();

  const startTime = Date.now();

  const callback = () => {
    if (Date.now() - startTime > MAX_WAIT_MS) {
      disconnectObserver();
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const fields = scanFields();
      const classified = classifyFields(fields);
      const fillable = filterClassified(classified);

      // Only fill empty fields
      for (const field of fillable) {
        const el = field.element;
        const isCE = el.getAttribute("contenteditable") === "true";
        const currentVal = isCE ? el.innerText : (el as HTMLInputElement).value;
        if (currentVal && currentVal.trim().length > 0) continue;

        fillField(field, profile);
      }
    }, DEBOUNCE_MS);
  };

  observer = new MutationObserver(callback);
  observer.observe(document.body, { childList: true, subtree: true });
}

export function disconnectObserver(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
