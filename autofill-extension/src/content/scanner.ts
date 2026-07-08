import type { FieldMeta } from "../lib/types";

const FIELD_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="textbox"], [role="tree"], [role="menu"]';

const HIDDEN_TYPES = new Set(["hidden", "submit", "button", "file", "image", "reset"]);

function isVisible(el: HTMLElement): boolean {
  if (!el.ownerDocument) return false;
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!cs) return false;
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  if (el.offsetParent === null && cs.position !== "fixed" && cs.position !== "sticky") return false;
  return true;
}

function getXPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentElement;
  }
  return "/" + parts.join("/");
}

function resolveLabelText(el: HTMLElement): string {
  // (a) <label for={id}> exact match
  const id = el.id;
  if (id) {
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return label.textContent?.trim() || "";
  }

  // (b) ancestor <label> wrapping the input
  let parent: HTMLElement | null = el.parentElement;
  while (parent && parent !== document.body) {
    if (parent.tagName === "LABEL") return parent.textContent?.trim() || "";
    parent = parent.parentElement;
  }

  // (c) nearest preceding sibling text node
  const prevSibling = el.previousSibling;
  if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    const text = prevSibling.textContent?.trim();
    if (text) return text;
  }

  // (d) nearest text node within 2 DOM levels up
  let ancestor: HTMLElement | null = el.parentElement;
  let hops = 0;
  while (ancestor && hops < 2) {
    for (const child of Array.from(ancestor.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text && text.length > 1) return text;
      }
    }
    // Check aria-labelledby
    const labelledBy = ancestor.getAttribute("aria-labelledby");
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/);
      const texts = parts
        .map((p) => el.ownerDocument.getElementById(p)?.textContent?.trim())
        .filter(Boolean);
      if (texts.length) return texts.join(" ");
    }
    ancestor = ancestor.parentElement;
    hops++;
  }

  return "";
}

function getNearbyText(el: HTMLElement): string {
  const parent = el.parentElement;
  if (!parent) return "";

  const texts: string[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child === el) continue;
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent?.trim();
      if (t) texts.push(t);
    } else if (child instanceof HTMLElement) {
      const t = child.textContent?.trim();
      if (t && t.length < 100) texts.push(t);
    }
  }
  return texts.join(" ").slice(0, 200);
}

function collectFromRoot(root: Document | ShadowRoot): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const nodes = root.querySelectorAll(FIELD_SELECTOR);
  for (const node of nodes) {
    if (node instanceof HTMLElement) elements.push(node);
  }

  // Recurse into shadow DOMs
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot) {
      elements.push(...collectFromRoot(el.shadowRoot));
    }
  }

  // Recurse into same-origin iframes
  const iframes = root.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        elements.push(...collectFromRoot(iframe.contentDocument));
      }
    } catch {
      // Cross-origin iframe — skip
    }
  }

  return elements;
}

export function scanFields(): FieldMeta[] {
  const elements = collectFromRoot(document);
  const fields: FieldMeta[] = [];

  for (const el of elements) {
    const tag = el.tagName;
    const inputType = el instanceof HTMLInputElement ? el.type?.toLowerCase() : undefined;

    // Filter out hidden/non-fillable
    if (inputType && HIDDEN_TYPES.has(inputType)) continue;
    if (!isVisible(el)) continue;
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) continue;

    fields.push({
      element: el,
      tagName: tag,
      inputType,
      id: el.id || undefined,
      name: el.getAttribute("name") || undefined,
      placeholder: el.getAttribute("placeholder") || undefined,
      ariaLabel: el.getAttribute("aria-label") || undefined,
      title: el.getAttribute("title") || undefined,
      autocomplete: el.getAttribute("autocomplete") || undefined,
      labelText: resolveLabelText(el),
      nearbyText: getNearbyText(el),
      required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
      visible: isVisible(el),
      disabled: (el as HTMLInputElement).disabled || false,
      readonly: (el as HTMLInputElement).readOnly || false,
      xpath: getXPath(el),
      role: el.getAttribute("role") || undefined,
    });
  }

  return fields;
}
