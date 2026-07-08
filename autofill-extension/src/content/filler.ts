import type { ClassifiedField, FillResult, UserProfile } from "../lib/types";
import { mapToProfile, findSelectOption } from "./mapper";

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  try {
    setter ? setter.call(el, value) : (el.value = value);
  } catch {
    el.value = value;
  }
}

function dispatchEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchBlur(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

function fillTextInput(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.focus();
  nativeSet(el, value);
  dispatchEvents(el);
  dispatchBlur(el);
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const option = findSelectOption(el, value);
  if (!option) return false;

  el.value = option.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  return true;
}

function fillRadio(el: HTMLInputElement, value: string): void {
  // Find the label for this radio
  const label = el.labels?.[0];
  const labelText = label?.textContent?.trim().toLowerCase() || "";
  const valueLower = value.toLowerCase();

  if (
    labelText.includes(valueLower) ||
    valueLower.includes(labelText) ||
    el.value.toLowerCase() === valueLower
  ) {
    el.click();
  }
}

function fillCheckbox(el: HTMLInputElement, value: string): void {
  const shouldCheck = value === "true" || value === "yes" || value === "1";
  if (el.checked !== shouldCheck) {
    el.click();
  }
}

function fillContentEditable(el: HTMLElement, value: string): void {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })
  );
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

function fillDateInput(el: HTMLInputElement, value: string): void {
  // Try to format as YYYY-MM-DD for native date inputs
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    const formatted = date.toISOString().split("T")[0];
    nativeSet(el, formatted);
    dispatchEvents(el);
    dispatchBlur(el);
  }
}

export function fillField(field: ClassifiedField, profile: UserProfile): FillResult {
  try {
    const value = mapToProfile(field.category, profile);

    // Skip fields with no data
    if (value === null || value === "") {
      return { field, status: "skipped_no_data", reason: `No profile data for ${field.category}` };
    }

    // Skip fields we can't fill
    if (field.category === "RESUME_UPLOAD") {
      return { field, status: "skipped_no_data", reason: "File upload requires manual action" };
    }

    if (field.category === "COVER_LETTER") {
      return { field, status: "skipped_no_data", reason: "Cover letter requires manual input" };
    }

    const el = field.element;
    const strValue = Array.isArray(value) ? value.join(", ") : value;

    // ContentEditable
    if (field.role === "textbox" || el.getAttribute("contenteditable") === "true") {
      fillContentEditable(el, strValue);
      return { field, status: "filled" };
    }

    // Select
    if (el instanceof HTMLSelectElement) {
      const success = fillSelect(el, strValue);
      if (!success) {
        return { field, status: "skipped_no_data", reason: `No matching option for "${strValue}"` };
      }
      return { field, status: "filled" };
    }

    // Radio
    if (el instanceof HTMLInputElement && el.type === "radio") {
      fillRadio(el, strValue);
      return { field, status: "filled" };
    }

    // Checkbox
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      fillCheckbox(el, strValue);
      return { field, status: "filled" };
    }

    // Date
    if (el instanceof HTMLInputElement && el.type === "date") {
      fillDateInput(el, strValue);
      return { field, status: "filled" };
    }

    // Text-like inputs
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      fillTextInput(el, strValue);
      return { field, status: "filled" };
    }

    return { field, status: "error", reason: "Unsupported field type" };
  } catch (e) {
    return {
      field,
      status: "error",
      reason: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
