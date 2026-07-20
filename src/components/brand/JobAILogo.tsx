import { useId } from "react";
import { cn } from "@/lib/utils";

type JobAILogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  animated?: boolean;
  inverse?: boolean;
};

/**
 * The Scout Signal: a directional path, north star, and AI orbit in one mark.
 * Motion is CSS-only so it stays lightweight and respects reduced-motion settings.
 */
export function JobAILogo({
  className,
  markClassName,
  showWordmark = true,
  animated = true,
  inverse = true,
}: JobAILogoProps) {
  const rawId = useId().replace(/:/g, "");
  const gradientId = `scout-gradient-${rawId}`;
  const glowId = `scout-glow-${rawId}`;

  return (
    <span className={cn("jobai-brand", className)} aria-label="JobAI Scout">
      <span className={cn("jobai-mark", animated && "jobai-mark--animated", markClassName)} aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id={gradientId} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67E8F9" />
              <stop offset=".43" stopColor="#6374FF" />
              <stop offset="1" stopColor="#A855F7" />
            </linearGradient>
            <filter id={glowId} x="-45%" y="-45%" width="190%" height="190%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle className="jobai-mark__halo" cx="24" cy="24" r="20.5" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.25" opacity=".42" />
          <path className="jobai-mark__orbit" d="M7.3 28.4C10 39 21.8 44.8 32.2 40.6 42.6 36.5 46.9 24.4 42.1 14.2" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
          <path d="M17.5 10.5v18.2c0 5.8 3.1 8.8 8.4 8.8 5.5 0 8.7-3.3 8.7-9.1v-6.1" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m29.7 15.2 5.2-8.6 5.2 8.6-5.2-2.2-5.2 2.2Z" fill={`url(#${gradientId})`} filter={`url(#${glowId})`} />
          <circle className="jobai-mark__signal" cx="8.2" cy="27.3" r="2.75" fill="#67E8F9" filter={`url(#${glowId})`} />
          <circle className="jobai-mark__satellite" cx="42" cy="14" r="2.15" fill="#C084FC" />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn("jobai-wordmark", inverse ? "text-white" : "text-slate-950")}>
          JobAI <span>Scout</span>
        </span>
      )}
    </span>
  );
}
