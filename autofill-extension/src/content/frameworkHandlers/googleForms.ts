import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

export function handleGoogleForms(
  field: ClassifiedField,
  profile: UserProfile
): boolean {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // Google Forms uses role="radio" / role="checkbox" on divs
  if (el.getAttribute("role") === "radio") {
    const label = el.closest("[role='listitem']")?.textContent?.trim().toLowerCase() || "";
    if (label.includes(strValue.toLowerCase())) {
      el.click();
      return true;
    }
    return false;
  }

  if (el.getAttribute("role") === "checkbox") {
    const shouldCheck = strValue === "true" || strValue === "yes";
    const isChecked = el.getAttribute("aria-checked") === "true";
    if (shouldCheck !== isChecked) {
      el.click();
    }
    return true;
  }

  // Standard input/textarea
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    try {
      setter ? setter.call(el, strValue) : (el.value = strValue);
    } catch {
      el.value = strValue;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    return true;
  }

  return false;
}
