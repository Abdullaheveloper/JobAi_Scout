import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileReadinessItem } from "@/lib/profile-readiness";
import { useTranslation } from "react-i18next";

type ProfileReadinessCardProps = {
  items: ProfileReadinessItem[];
  percent: number;
  /** When true, show the “X% complete” header badge (Profile Settings). */
  showHeaderCompleteBadge?: boolean;
  /** When true, only list field badges if something is missing (Upload CV). */
  hideBadgesWhenComplete?: boolean;
  className?: string;
};

export function ProfileReadinessCard({
  items,
  percent,
  showHeaderCompleteBadge = false,
  hideBadgesWhenComplete = false,
  className,
}: ProfileReadinessCardProps) {
  const { t } = useTranslation();
  const missingCount = items.filter((item) => !item.done).length;
  const showBadges = !hideBadgesWhenComplete || missingCount > 0;

  return (
    <Card className={className ?? "border-border bg-card shadow-card"}>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-display text-sm font-semibold">{t("cv.profileReadiness")}</span>
          {showHeaderCompleteBadge ? (
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              {t("cv.percentComplete", { percent })}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              {t("cv.percent", { percent })}
            </Badge>
          )}
        </div>

        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {missingCount > 0
              ? t("cv.detailsLeft", { count: missingCount })
              : t("cv.readyToApply")}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${percent}%`,
              background:
                percent === 100
                  ? "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
            }}
          />
        </div>

        {showBadges && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <Badge
                key={item.key}
                variant="outline"
                className={`text-xs transition-all duration-300 ${
                  item.done
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                }`}
              >
                {item.done ? "✓" : "✗"} {item.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProfileReadinessCard;
