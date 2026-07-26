import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_FUZZY_THRESHOLD,
  DEFAULT_MAX_RESULTS,
  searchTaxonomy,
  type FuzzyMatchResult,
  type TaxonomyEntry,
} from "./normalizeTaxonomy";

export type UseFuzzyTaxonomyOptions = {
  threshold?: number;
  maxResults?: number;
  debounceMs?: number;
  onUnmatched?: ((term: string) => void) | null;
};

export type UseFuzzyTaxonomyReturn = {
  search: (value: string) => void;
  results: FuzzyMatchResult[];
  query: string;
};

const DEFAULT_DEBOUNCE_MS = 180;

export function useFuzzyTaxonomy(
  taxonomy: TaxonomyEntry[],
  options: UseFuzzyTaxonomyOptions = {},
): UseFuzzyTaxonomyReturn {
  const {
    threshold = DEFAULT_FUZZY_THRESHOLD,
    maxResults = DEFAULT_MAX_RESULTS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onUnmatched = null,
  } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FuzzyMatchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUnmatchedRef = useRef(onUnmatched);
  onUnmatchedRef.current = onUnmatched;

  const taxonomyKey = useMemo(
    () => taxonomy.map((entry) => `${entry.canonical}|${entry.aliases.join(",")}`).join(";;"),
    [taxonomy],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const top = searchTaxonomy(query, taxonomy, { threshold, maxResults });
      setResults(top);

      const hasConfidentMatch = top.length > 0 && top[0].score <= 0.45;
      if (!hasConfidentMatch && onUnmatchedRef.current) {
        onUnmatchedRef.current(query.trim());
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // taxonomyKey stands in for taxonomy identity to avoid resubscribing on new array refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, taxonomyKey, threshold, maxResults, debounceMs]);

  const search = useCallback((value: string) => {
    setQuery(value);
  }, []);

  return { search, results, query };
}

export default useFuzzyTaxonomy;
