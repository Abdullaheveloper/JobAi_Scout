import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

function waitForElement(
  selector: string,
  root: Element | Document,
  timeoutMs = 2000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = root.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

export async function handleReactSelect(
  field: ClassifiedField,
  profile: UserProfile
): Promise<boolean> {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // React Select uses a hidden input + a div container
  // Click the control to open the dropdown
  const control = el.closest(".react-select__control") || el.parentElement;
  if (!control) return false;

  const controlDiv = control instanceof HTMLElement ? control : null;
  if (!controlDiv) return false;

  controlDiv.click();
  await new Promise((r) => setTimeout(r, 200));

  // Wait for the menu to appear
  const menu = await waitForElement(".react-select__menu", document, 1500);
  if (!menu) return false;

  // Find the option by text
  const options = menu.querySelectorAll(".react-select__option");
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() || "";
    if (text.includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text)) {
      (opt as HTMLElement).click();
      return true;
    }
  }

  // If not found, try typing in the input
  const input = control.querySelector("input");
  if (input) {
    input.focus();
    input.value = strValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));

    // Try clicking first option
    const firstOption = menu.querySelector(".react-select__option");
    if (firstOption) {
      (firstOption as HTMLElement).click();
      return true;
    }
  }

  return false;
}
