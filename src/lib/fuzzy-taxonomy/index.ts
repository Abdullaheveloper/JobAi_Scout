export {
  normalizeWithTaxonomy,
  normalizeListWithTaxonomy,
  applyTaxonomyToExtractedData,
  searchTaxonomy,
  DEFAULT_FUZZY_THRESHOLD,
  DEFAULT_MAX_RESULTS,
  DEFAULT_CONFIDENT_SCORE,
  type TaxonomyEntry,
  type FuzzyMatchResult,
  type NormalizeTaxonomyOptions,
} from "./normalizeTaxonomy";

export { useFuzzyTaxonomy, type UseFuzzyTaxonomyOptions, type UseFuzzyTaxonomyReturn } from "./useFuzzyTaxonomy";

export {
  FuzzyAutocompleteInput,
  type FuzzyAutocompleteInputProps,
} from "./FuzzyAutocompleteInput";

export { default as jobTaxonomy } from "./data/job-taxonomy.json";
export { default as skillsTaxonomy } from "./data/skills-taxonomy.json";
export { default as locationTaxonomy } from "./data/location-taxonomy.json";
