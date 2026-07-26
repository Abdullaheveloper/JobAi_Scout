import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFuzzyTaxonomy } from "./useFuzzyTaxonomy";
import type { TaxonomyEntry } from "./normalizeTaxonomy";

export type FuzzyAutocompleteInputProps = {
  taxonomy: TaxonomyEntry[];
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is chosen or Enter commits a value (canonical preferred). */
  onCommit?: (value: string) => void;
  /** Clear the input after a commit (multi-tag entry). */
  clearOnCommit?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  "aria-label"?: string;
  "aria-required"?: boolean | "true" | "false";
  onUnmatchedTerm?: (term: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
};

export function FuzzyAutocompleteInput({
  taxonomy,
  value,
  onChange,
  onCommit,
  clearOnCommit = false,
  placeholder = "Start typing...",
  disabled,
  className,
  inputClassName,
  id,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  onUnmatchedTerm,
  onKeyDown,
  autoFocus,
}: FuzzyAutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { search, results } = useFuzzyTaxonomy(taxonomy, {
    threshold: 0.35,
    maxResults: 5,
    debounceMs: 180,
    onUnmatched: onUnmatchedTerm,
  });

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitSelection = (canonicalValue: string) => {
    if (clearOnCommit) {
      setInputValue("");
      onChange("");
      search("");
    } else {
      setInputValue(canonicalValue);
      onChange(canonicalValue);
    }
    onCommit?.(canonicalValue);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (next: string) => {
    setInputValue(next);
    onChange(next);
    search(next);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && results.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
        return;
      }
      if (event.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < results.length) {
          event.preventDefault();
          commitSelection(results[activeIndex].canonical);
          return;
        }
        if (onCommit && inputValue.trim()) {
          event.preventDefault();
          const best = results[0];
          const commitValue = best && best.score <= 0.45 ? best.canonical : inputValue.trim();
          commitSelection(commitValue);
          return;
        }
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
    } else if (event.key === "Enter" && onCommit && inputValue.trim()) {
      event.preventDefault();
      commitSelection(inputValue.trim());
      return;
    }

    onKeyDown?.(event);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <Input
        id={id}
        type="text"
        value={inputValue}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-required={ariaRequired}
        aria-autocomplete="list"
        aria-expanded={isOpen && results.length > 0}
        aria-controls={isOpen && results.length > 0 ? `${id || "fuzzy"}-listbox` : undefined}
        placeholder={placeholder}
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (inputValue.trim().length >= 2) setIsOpen(true);
        }}
        className={inputClassName}
      />
      {isOpen && results.length > 0 && (
        <ul
          id={`${id || "fuzzy"}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.map((result, idx) => (
            <li
              key={result.canonical}
              role="option"
              aria-selected={idx === activeIndex}
              className={cn(
                "cursor-pointer rounded-sm px-3 py-2 text-sm",
                idx === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(event) => {
                event.preventDefault();
                commitSelection(result.canonical);
              }}
            >
              {result.canonical}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FuzzyAutocompleteInput;
