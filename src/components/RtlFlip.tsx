import { useTranslation } from "react-i18next";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";
import { cn } from "@/lib/utils";

type RtlFlipProps = {
  children: React.ReactNode;
  className?: string;
  /** When true, always flip in RTL (chevrons, arrows pointing "forward") */
  enabled?: boolean;
};

/**
 * Horizontally mirrors directional icons in RTL layouts.
 */
export function RtlFlip({ children, className, enabled = true }: RtlFlipProps) {
  const { i18n } = useTranslation();
  const rtl = isRtlLocale(resolveLocale(i18n.resolvedLanguage || i18n.language));
  return (
    <span className={cn("inline-flex", enabled && rtl && "rtl-flip", className)}>
      {children}
    </span>
  );
}
