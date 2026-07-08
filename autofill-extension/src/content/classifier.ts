import type { ClassifiedField, FieldCategory, FieldMeta } from "../lib/types";
import { synonymDictionary } from "../lib/synonymDictionary";
import { MIN_CONFIDENCE } from "../lib/constants";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function buildContextText(field: FieldMeta): string {
  const parts = [
    field.name,
    field.id,
    field.placeholder,
    field.inputType,
    field.ariaLabel,
    field.autocomplete,
    field.title,
    field.role,
    field.labelText,
    field.nearbyText,
  ].filter(Boolean);

  return normalize(parts.join(" "));
}

function checkAutocomplete(el: HTMLElement): { category: FieldCategory; confidence: number } | null {
  const ac = el.getAttribute("autocomplete")?.toLowerCase();
  if (!ac) return null;

  const map: Record<string, FieldCategory> = {
    email: "EMAIL",
    name: "FULL_NAME",
    "given-name": "FIRST_NAME",
    "family-name": "LAST_NAME",
    tel: "PHONE",
    "tel-mobile": "PHONE",
    address: "ADDRESS",
    "postal-code": "POSTAL_CODE",
    url: "PORTFOLIO",
  };

  // Exact match
  if (map[ac]) return { category: map[ac], confidence: 0.95 };

  // Prefix match for tel
  if (ac.startsWith("tel")) return { category: "PHONE", confidence: 0.93 };

  return null;
}

function checkInputType(el: HTMLElement): { category: FieldCategory; confidence: number } | null {
  if (!(el instanceof HTMLInputElement)) return null;

  const type = el.type?.toLowerCase();
  if (type === "email") return { category: "EMAIL", confidence: 0.97 };
  if (type === "tel") return { category: "PHONE", confidence: 0.95 };

  return null;
}

function scoreSynonyms(
  contextText: string,
  category: FieldCategory
): { score: number; matched: string[] } {
  const synonyms = synonymDictionary[category];
  if (!synonyms.length) return { score: 0, matched: [] };

  const matched: string[] = [];
  for (const synonym of synonyms) {
    if (contextText.includes(synonym)) {
      matched.push(synonym);
    }
  }

  if (matched.length === 0) return { score: 0, matched: [] };

  // Score based on match quality
  let score = 0.7; // base score for any match

  // Bonus: exact match (context == synonym)
  if (matched.some((m) => contextText === m)) {
    score = 0.95;
  }
  // Bonus: multiple matches
  else if (matched.length > 1) {
    score = Math.min(0.9, score + 0.1);
  }

  return { score, matched };
}

function classifyField(field: FieldMeta): ClassifiedField {
  // Priority 1: autocomplete attribute
  const acResult = checkAutocomplete(field.element);
  if (acResult) {
    return { ...field, category: acResult.category, confidence: acResult.confidence };
  }

  // Priority 2: input type
  const typeResult = checkInputType(field.element);
  if (typeResult) {
    return { ...field, category: typeResult.category, confidence: typeResult.confidence };
  }

  // Priority 3: synonym matching
  const contextText = buildContextText(field);
  if (!contextText) {
    return { ...field, category: "UNKNOWN", confidence: 0 };
  }

  let bestCategory: FieldCategory = "UNKNOWN";
  let bestScore = 0;
  let bestMatched: string[] = [];

  const categories = Object.keys(synonymDictionary) as FieldCategory[];
  for (const category of categories) {
    if (category === "UNKNOWN") continue;
    const { score, matched } = scoreSynonyms(contextText, category);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
      bestMatched = matched;
    }
  }

  return {
    ...field,
    category: bestCategory,
    confidence: bestScore,
  };
}

export function classifyFields(fields: FieldMeta[]): ClassifiedField[] {
  return fields.map((field) => classifyField(field));
}

export function filterClassified(fields: ClassifiedField[]): ClassifiedField[] {
  return fields.filter((f) => f.confidence >= MIN_CONFIDENCE && f.category !== "UNKNOWN");
}
