import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider";

type InlineFrom = "sm" | "md" | "lg";

type NavAppearanceControlsProps = {
  className?: string;
  variant?: "dark" | "light" | "auto";
  /**
   * Show Theme + Language inline from this breakpoint up;
   * below it, collapse into a single settings menu.
   * Default `sm` (640px) keeps 375–414 usable.
   */
  inlineFrom?: InlineFrom;
};

const INLINE_WRAP: Record<InlineFrom, string> = {
  sm: "hidden sm:flex",
  md: "hidden md:flex",
  lg: "hidden lg:flex",
};

const MENU_WRAP: Record<InlineFrom, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
};

/**
 * Theme + language for navbars. On narrow viewports collapses into one
 * settings control so primary CTAs stay visible and tappable.
 */
export function NavAppearanceControls({
  className,
  variant = "auto",
  inlineFrom = "sm",
}: NavAppearanceControlsProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const resolvedVariant =
    variant === "auto" ? (theme === "dark" ? "dark" : "light") : variant;

  const triggerClass =
    resolvedVariant === "light"
      ? "border-border/70 bg-transparent text-foreground hover:bg-muted/50"
      : "border-border bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground";

  return (
    <div className={cn("flex items-center", className)}>
      <div className={cn(INLINE_WRAP[inlineFrom], "items-center gap-2")}>
        <ThemeToggle variant={variant} />
        <LanguageSwitcher variant={variant} />
      </div>

      <div className={MENU_WRAP[inlineFrom]}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40 focus-visible:ring-offset-background",
                triggerClass,
              )}
              aria-label={t("common.appearanceSettings")}
              title={t("common.appearanceSettings")}
            >
              <Settings2 className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2" sideOffset={8}>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              {t("common.appearanceSettings")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="space-y-3 px-1 py-1.5">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t("common.theme")}</p>
                <ThemeToggle variant={variant} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t("common.language")}</p>
                <LanguageSwitcher variant={variant} className="w-full" triggerClassName="w-full max-w-none sm:min-w-0" />
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
