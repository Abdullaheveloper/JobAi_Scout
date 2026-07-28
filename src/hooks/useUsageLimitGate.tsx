import { useCallback, useState, type ReactNode } from "react";
import { UsageLimitReached } from "@/components/UsageLimitReached";
import {
  buildUsageLimitViewModel,
  type UsageLimitErrorPayload,
  type UsageLimitViewModel,
} from "@/lib/usage-limits-client";
import { useTranslation } from "react-i18next";

type UsageLimitGateOptions = {
  variant?: "banner" | "dialog";
};

type UsageLimitGateState = UsageLimitViewModel & {
  variant: "banner" | "dialog";
};

export function useUsageLimitGate() {
  const { t } = useTranslation();
  const [state, setState] = useState<UsageLimitGateState | null>(null);

  const showUsageLimit = useCallback(
    (payload: UsageLimitErrorPayload, options?: UsageLimitGateOptions) => {
      setState({
        ...buildUsageLimitViewModel(payload, t),
        variant: options?.variant ?? "banner",
      });
    },
    [t],
  );

  const dismissUsageLimit = useCallback(() => setState(null), []);

  const usageLimitNotice: ReactNode = state ? (
    <UsageLimitReached
      {...state}
      open
      onDismiss={dismissUsageLimit}
    />
  ) : null;

  return {
    showUsageLimit,
    dismissUsageLimit,
    usageLimitNotice,
    usageLimitActive: Boolean(state),
  };
}
