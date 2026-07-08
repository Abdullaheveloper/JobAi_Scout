import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

export async function handleMuiCombobox(
  field: ClassifiedField,
  profile: UserProfile
): Promise<boolean> {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // MUI Autocomplete uses an input inside a div with role="combobox"
  const combobox = el.closest('[role="combobox"]') || el.parentElement;
  if (!combobox) return false;

  const input = combobox.querySelector("input");
  if (!input) return false;

  // Click to open
  input.focus();
  (input as HTMLInputElement).value = strValue;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));

  // Wait for listbox
  const listbox = await new Promise<Element | null>((resolve) => {
    const check = () => {
      const lb = document.querySelector('[role="listbox"]');
      if (lb) return resolve(lb);
      setTimeout(check, 100);
    };
    check();
    setTimeout(() => resolve(null), 1500);
  });

  if (!listbox) return false;

  // Find matching option
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
