import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

export async function handleHeadlessUI(
  field: ClassifiedField,
  profile: UserProfile
): Promise<boolean> {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // Headless UI uses role="listbox" and role="option"
  const listbox = el.closest('[role="listbox"]');
  if (listbox) {
    const options = listbox.querySelectorAll('[role="option"]');
    for (const opt of options) {
      const text = opt.textContent?.trim().toLowerCase() || "";
      if (text.includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text)) {
        (opt as HTMLElement).click();
        return true;
      }
    }
    return false;
  }

  // Try combobox pattern
  const combobox = el.closest('[role="combobox"]');
  if (combobox) {
    (combobox as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 300));

    const options = document.querySelectorAll('[role="option"]');
    for (const opt of options) {
      const text = opt.textContent?.trim().toLowerCase() || "";
      if (text.includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text)) {
        (opt as HTMLElement).click();
        return true;
      }
    }
  }

  return false;
}
