import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

export async function handleRadix(
  field: ClassifiedField,
  profile: UserProfile
): Promise<boolean> {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // Radix Select uses data attributes
  const trigger = el.closest("[data-radix-select-trigger]") || el.closest("[role='combobox']");
  if (!trigger) return false;

  (trigger as HTMLElement).click();
  await new Promise((r) => setTimeout(r, 300));

  // Wait for content
  const content = await new Promise<Element | null>((resolve) => {
    const check = () => {
      const c = document.querySelector("[data-radix-select-content]");
      if (c) return resolve(c);
      setTimeout(check, 100);
    };
    check();
    setTimeout(() => resolve(null), 1500);
  });

  if (!content) return false;

  const items = content.querySelectorAll("[data-radix-select-item]");
  for (const item of items) {
    const text = item.textContent?.trim().toLowerCase() || "";
    if (text.includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text)) {
      (item as HTMLElement).click();
      return true;
    }
  }

  return false;
}
