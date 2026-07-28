import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  title: string;
  description: string;
  reloadLabel: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

class RouteErrorBoundaryInner extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center"
          role="alert"
        >
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold text-foreground">{this.props.title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{this.props.description}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            {this.props.reloadLabel}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Catches render errors in dashboard page trees and shows a recoverable fallback. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <RouteErrorBoundaryInner
      title={t("common.errorBoundaryTitle", { defaultValue: "Something went wrong" })}
      description={t("common.errorBoundaryDescription", {
        defaultValue: "This page could not be displayed. Try reloading.",
      })}
      reloadLabel={t("common.errorBoundaryReload", { defaultValue: "Reload page" })}
    >
      {children}
    </RouteErrorBoundaryInner>
  );
}
