import type { ClassifiedField } from "../lib/types";

let hostElement: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
const highlightedElements: HTMLElement[] = [];

export function createOverlay(): void {
  removeOverlay();

  hostElement = document.createElement("div");
  hostElement.id = "autofill-pro-overlay";
  hostElement.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(hostElement);
  shadowRoot = hostElement.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    .highlight {
      outline: 2px dashed #f59e0b;
      outline-offset: 2px;
      background-color: rgba(245, 158, 11, 0.05);
      transition: outline-color 0.3s, background-color 0.3s;
    }
    .highlight:hover {
      outline-color: #3b82f6;
      background-color: rgba(59, 130, 246, 0.08);
    }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 2147483647;
      pointer-events: auto;
      animation: slideUp 0.3s ease;
      max-width: 360px;
    }
    .toast.success { border-left: 4px solid #10b981; }
    .toast.warning { border-left: 4px solid #f59e0b; }
    .toast.error { border-left: 4px solid #ef4444; }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  shadowRoot.appendChild(style);
}

export function highlightFields(fields: ClassifiedField[]): void {
  if (!shadowRoot) createOverlay();
  clearHighlights();

  for (const field of fields) {
    const el = field.element;
    if (!el || !el.ownerDocument) continue;

    try {
      el.classList.add("highlight");
      highlightedElements.push(el);
    } catch {
      // Skip elements that can't be styled
    }
  }

  // Scroll first highlighted field into view
  if (highlightedElements.length > 0) {
    highlightedElements[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function clearHighlights(): void {
  for (const el of highlightedElements) {
    try {
      el.classList.remove("highlight");
    } catch {}
  }
  highlightedElements.length = 0;
}

export function showToast(
  message: string,
  type: "success" | "warning" | "error" = "success",
  durationMs = 3000
): void {
  if (!shadowRoot) createOverlay();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  shadowRoot!.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

export function removeOverlay(): void {
  clearHighlights();
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
    shadowRoot = null;
  }
}
