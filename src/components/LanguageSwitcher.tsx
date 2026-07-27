import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES, type AppLocale, resolveLocale } from "@/i18n/languages";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

type LanguageSwitcherProps = {
  className?: string;
  /** Visual density — auto follows current theme */
  variant?: "dark" | "light" | "auto";
};

export function LanguageSwitcher({ className, variant = "auto" }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const current = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const resolvedVariant =
    variant === "auto" ? (theme === "dark" ? "dark" : "light") : variant;

  const onChange = (value: string) => {
    void i18n.changeLanguage(resolveLocale(value) as AppLocale);
  };

  const triggerClass =
    resolvedVariant === "light"
      ? "h-9 min-w-[8.5rem] w-auto max-w-[12rem] border-border bg-background text-foreground shadow-none focus:ring-primary/30"
      : "h-9 min-w-[8.5rem] w-auto max-w-[12rem] border-border bg-muted/40 text-muted-foreground shadow-none hover:border-primary/30 hover:text-foreground focus:ring-primary/30";

  return (
    <div className={cn("flex items-center gap-1.5", className)} title={t("common.selectLanguage")}>
      <Languages
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger
          className={triggerClass}
          aria-label={t("common.selectLanguage")}
        >
          <SelectValue placeholder={t("common.language")} />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
