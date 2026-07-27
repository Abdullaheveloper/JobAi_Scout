import { cn } from "@/lib/utils";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

type MixedDirProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

/**
 * Isolates user/scraped content (company names, titles, emails, URLs)
 * so LTR fragments render correctly inside an RTL UI.
 */
export function MixedDir({
  children,
  className,
  as: Tag = "span",
  ...rest
}: MixedDirProps) {
  return (
    <Tag
      dir="auto"
      className={cn("unicode-bidi-plaintext", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
