import type { ClassifiedField, FillResult, UserProfile } from "../lib/types";
import { scanFields } from "./scanner";
import { classifyFields, filterClassified } from "./classifier";
import { fillField } from "./filler";
import { setupObserver, disconnectObserver } from "./observer";
import {
  createOverlay,
  highlightFields,
  clearHighlights,
  showToast,
  removeOverlay,
} from "./overlay";
import { handleGoogleForms } from "./frameworkHandlers/googleForms";
import { handleReactSelect } from "./frameworkHandlers/reactSelect";
import { handleMuiCombobox } from "./frameworkHandlers/muiCombobox";
import { handleAntDesign } from "./frameworkHandlers/antDesign";
import { handleRadix } from "./frameworkHandlers/radix";
import { handleHeadlessUI } from "./frameworkHandlers/headlessUI";

// Guard against double-injection
if (!(window as any).__AUTOFILL_PRO_LOADED__) {
  (window as any).__AUTOFILL_PRO_LOADED__ = true;

  const LOG = (...args: unknown[]) =>
    console.log("%c[AutoFill Pro]", "color:#6366f1;font-weight:bold", ...args);

  // Classification cache per page
  const classificationCache = new Map<string, ClassifiedField[]>();

  function getCacheKey(fields: ClassifiedField[]): string {
    const sigs = fields
      .map((f) => `${f.tagName}|${f.inputType || ""}|${f.name || ""}|${f.id || ""}`)
      .join(";");
    return location.href + "|" + sigs;
  }

  async function handleFillForm(profile: UserProfile): Promise<{
    results: FillResult[];
    filledCount: number;
    skippedCount: number;
    unknownCount: number;
  }> {
    createOverlay();
    clearHighlights();

    LOG("Starting fill pipeline on", location.href);

    // Step 1: Scan
    const rawFields = scanFields();
    LOG(`Scanned ${rawFields.length} fields`);

    // Step 2: Classify (with cache)
    const cacheKey = getCacheKey(rawFields as any);
    let classified = classificationCache.get(cacheKey);
    if (!classified) {
      classified = classifyFields(rawFields);
      classificationCache.set(cacheKey, classified);
    }

    const fillable = filterClassified(classified);
    LOG(`Classified ${fillable.length} fillable fields`);

    // Step 3: Detect framework and fill
    const results: FillResult[] = [];
    const unfilled: ClassifiedField[] = [];
    const isGoogleForms = location.hostname.includes("docs.google.com");

    for (const field of fillable) {
      // Skip already filled
      const el = field.element;
      const isCE = el.getAttribute("contenteditable") === "true";
      const currentVal = isCE ? el.innerText : (el as HTMLInputElement).value;
      if (currentVal && currentVal.trim().length > 0) continue;

      let result: FillResult;

      // Route to framework-specific handler
      if (isGoogleForms) {
        const handled = handleGoogleForms(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "Google Forms handler failed" };
      } else if (isReactSelect(field)) {
        const handled = await handleReactSelect(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "React Select handler failed" };
      } else if (isMuiCombobox(field)) {
        const handled = await handleMuiCombobox(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "MUI handler failed" };
      } else if (isAntDesign(field)) {
        const handled = await handleAntDesign(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "Ant Design handler failed" };
      } else if (isRadix(field)) {
        const handled = await handleRadix(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "Radix handler failed" };
      } else if (isHeadlessUI(field)) {
        const handled = await handleHeadlessUI(field, profile);
        result = { field, status: handled ? "filled" : "error", reason: handled ? undefined : "Headless UI handler failed" };
      } else {
        // Native HTML fill
        result = fillField(field, profile);
      }

      results.push(result);

      if (result.status === "skipped_no_data" || result.status === "skipped_unknown") {
        unfilled.push(field);
      }
    }

    const filledCount = results.filter((r) => r.status === "filled").length;
    const skippedCount = results.filter((r) => r.status === "skipped_no_data").length;
    const unknownCount = classified.filter((f) => f.category === "UNKNOWN").length;

    LOG(`Filled: ${filledCount}, Skipped: ${skippedCount}, Unknown: ${unknownCount}`);

    // Highlight unfilled fields
    if (unfilled.length > 0) {
      highlightFields(unfilled);
      showToast(
        `${filledCount} fields filled · ${unfilled.length} need your input (highlighted)`,
        "warning",
        5000
      );
    } else {
      showToast(`${filledCount} fields filled successfully!`, "success");
    }

    // Setup observer for dynamic forms
    setupObserver(profile);

    return { results, filledCount, skippedCount, unknownCount };
  }

  // Framework detection helpers
  function isReactSelect(field: ClassifiedField): boolean {
    const el = field.element;
    return !!(
      el.closest(".react-select__control") ||
      el.closest("[class*='react-select']")
    );
  }

  function isMuiCombobox(field: ClassifiedField): boolean {
    const el = field.element;
    return !!(
      el.closest('[role="combobox"]') &&
      (el.closest(".MuiAutocomplete-root") || el.closest("[class*='MuiAutocomplete']"))
    );
  }

  function isAntDesign(field: ClassifiedField): boolean {
    return !!field.element.closest(".ant-select");
  }

  function isRadix(field: ClassifiedField): boolean {
    return !!(
      field.element.closest("[data-radix-select-trigger]") ||
      field.element.closest("[data-radix-select]")
    );
  }

  function isHeadlessUI(field: ClassifiedField): boolean {
    const el = field.element;
    return !!(
      el.closest("[role='listbox']") &&
      !el.closest(".react-select__control") &&
      !el.closest("[data-radix-select]")
    );
  }

  // ── Message Listener ──
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "FILL_FORM") {
      handleFillForm(msg.profile).then((result) => {
        sendResponse({
          ok: true,
          filledCount: result.filledCount,
          skippedCount: result.skippedCount,
          unknownCount: result.unknownCount,
          url: location.href,
        });
      });
      return true;
    }

    if (msg?.type === "SCAN_FIELDS") {
      const fields = scanFields();
      const classified = classifyFields(fields);
      const fillable = filterClassified(classified);
      sendResponse({ ok: true, fields: fillable, total: fields.length });
      return true;
    }

    if (msg?.type === "GET_UNFILLED") {
      const fields = scanFields();
      const classified = classifyFields(fields);
      const unfilled = classified.filter(
        (f) => f.confidence >= 0.6 && f.category !== "UNKNOWN"
      );
      sendResponse({ ok: true, fields: unfilled });
      return true;
    }

    if (msg?.type === "DISCONNECT_OBSERVER") {
      disconnectObserver();
      sendResponse({ ok: true });
      return true;
    }
  });

  LOG("Content script loaded");
}
