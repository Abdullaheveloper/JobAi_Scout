import { cn } from "@/lib/utils";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

/** URL / chrome-extension / file-path tokens that must stay LTR inside RTL copy. */
const LTR_TOKEN =
  /(https?:\/\/[^\s<>"')\]]+|chrome:\/\/[^\s<>"')\]]+|edge:\/\/[^\s<>"')\]]+|moz-extension:\/\/[^\s<>"')\]]+|\/[\w./@%+-]+)/gi;

type BidiTextProps = {
  text: string;
  className?: string;
  as?: ElementType;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

/**
 * Renders mixed-language sentences with plaintext bidi, isolating URL/path tokens as LTR.
 */
export function BidiText({ text, className, as: Tag = "span", ...rest }: BidiTextProps) {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(LTR_TOKEN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(
      <span key={`ltr-${match.index}`} dir="ltr" className="dir-ltr">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <Tag dir="auto" className={cn("unicode-bidi-plaintext", className)} {...rest}>
      {nodes}
    </Tag>
  );
}

type LtrProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

/** Force LTR isolation for URLs, emails, code, and numeric IDs. */
export function Ltr({ children, className, as: Tag = "span", ...rest }: LtrProps) {
  return (
    <Tag dir="ltr" className={cn("dir-ltr", className)} {...rest}>
      {children}
    </Tag>
  );
}

type BidiCountProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

/**
 * Isolates a count+label phrase (e.g. "2 roles suggested") as one directional unit.
 */
export function BidiCount({ children, className, ...rest }: BidiCountProps) {
  return (
    <bdi dir="auto" className={cn("inline", className)} {...rest}>
      {children}
    </bdi>
  );
}
