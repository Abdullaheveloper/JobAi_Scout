import type { ClassifiedField, UserProfile } from "../../lib/types";
import { mapToProfile } from "../mapper";

export async function handleAntDesign(
  field: ClassifiedField,
  profile: UserProfile
): Promise<boolean> {
  const value = mapToProfile(field.category, profile);
  if (!value) return false;
  const strValue = Array.isArray(value) ? value.join(", ") : value;

  const el = field.element;

  // Ant Design Select uses ant-select class
  const selectContainer = el.closest(".ant-select");
  if (!selectContainer) return false;

  // Click to open
  const selector = selectContainer.querySelector(".ant-select-selector");
  if (selector) (selector as HTMLElement).click();
  await new Promise((r) => setTimeout(r, 300));

  // Wait for dropdown
  const dropdown = await new Promise<Element | null>((resolve) => {
    const check = () => {
      const dd = document.querySelector(".ant-select-dropdown");
      if (dd) return resolve(dd);
      setTimeout(check, 100);
    };
    check();
    setTimeout(() => resolve(null), 1500);
  });

  if (!dropdown) return false;

  // Find matching option
  const options = dropdown.querySelectorAll(".ant-select-item-option");
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() || "";
    if (text.includes(strValue.toLowerCase()) || strValue.toLowerCase().includes(text)) {
      (opt as HTMLElement).click();
      return true;
    }
  }

  return false;
}
