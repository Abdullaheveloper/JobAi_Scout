import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** Visual density aligned with LanguageSwitcher */
  variant?: "dark" | "light" | "auto";
};

export function ThemeToggle({ className, variant = "auto" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const resolvedVariant =
    variant === "auto" ? (isDark ? "dark" : "light") : variant;

  const label = isDark ? t("common.switchToLight") : t("common.switchToDark");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40 focus-visible:ring-offset-background",
        resolvedVariant === "light"
          ? "border-border/70 bg-transparent text-foreground hover:bg-muted/50"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-out",
          isDark
            ? "rotate-90 scale-50 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-out",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-50 opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}
