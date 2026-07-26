import { describe, expect, it } from "vitest";
import {
  normalizeListWithTaxonomy,
  normalizeWithTaxonomy,
  searchTaxonomy,
} from "./normalizeTaxonomy";
import jobTaxonomy from "./data/job-taxonomy.json";
import skillsTaxonomy from "./data/skills-taxonomy.json";
import locationTaxonomy from "./data/location-taxonomy.json";

describe("normalizeWithTaxonomy", () => {
  it("maps Rect → React with confident match", () => {
    expect(normalizeWithTaxonomy("Rect", skillsTaxonomy)).toBe("React");
  });

  it("maps Ae Enginnr → AI Engineer with confident match", () => {
    expect(normalizeWithTaxonomy("Ae Enginnr", jobTaxonomy)).toBe("AI Engineer");
  });

  it("maps common aliases to canonical skills", () => {
    expect(normalizeWithTaxonomy("ReactJS", skillsTaxonomy)).toBe("React");
    expect(normalizeWithTaxonomy("Lang Chain", skillsTaxonomy)).toBe("LangChain");
    expect(normalizeWithTaxonomy("Postgres", skillsTaxonomy)).toBe("PostgreSQL");
  });

  it("maps job title aliases to canonical roles", () => {
    expect(normalizeWithTaxonomy("ML Engineer", jobTaxonomy)).toBe("Machine Learning Engineer");
    expect(normalizeWithTaxonomy("Front End Developer", jobTaxonomy)).toBe("Frontend Developer");
  });

  it("keeps free text when there is no confident match", () => {
    const odd = "Completely Unrelated Gibberish Xyzzy 999";
    expect(normalizeWithTaxonomy(odd, skillsTaxonomy)).toBe(odd);
  });

  it("returns empty string for blank input", () => {
    expect(normalizeWithTaxonomy("   ", skillsTaxonomy)).toBe("");
  });

  it("maps Islamabd → Islamabad, Pakistan", () => {
    expect(normalizeWithTaxonomy("Islamabd", locationTaxonomy)).toBe("Islamabad, Pakistan");
  });

  it("maps location aliases to canonical places", () => {
    expect(normalizeWithTaxonomy("Isb", locationTaxonomy)).toBe("Islamabad, Pakistan");
    expect(normalizeWithTaxonomy("Talagung", locationTaxonomy)).toBe("Talagang, Pakistan");
    expect(normalizeWithTaxonomy("WFH", locationTaxonomy)).toBe("Remote");
    expect(normalizeWithTaxonomy("NYC", locationTaxonomy)).toBe("New York, NY");
  });
});

describe("normalizeListWithTaxonomy", () => {
  it("normalizes and dedupes a mixed list", () => {
    const result = normalizeListWithTaxonomy(
      ["Rect", "React.js", "Ae Enginnr", "Custom Skill"],
      [...skillsTaxonomy, ...jobTaxonomy],
    );
    expect(result).toContain("React");
    expect(result).toContain("AI Engineer");
    expect(result).toContain("Custom Skill");
    expect(result.filter((item) => item === "React")).toHaveLength(1);
  });
});

describe("searchTaxonomy", () => {
  it("returns scored results sorted best-first", () => {
    const results = searchTaxonomy("React", skillsTaxonomy);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].canonical).toBe("React");
    expect(results[0].score).toBeLessThanOrEqual(0.45);
  });
});
