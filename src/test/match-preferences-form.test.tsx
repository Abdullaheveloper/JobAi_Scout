import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { MatchPreferencesForm } from "@/components/match/MatchPreferencesForm";

function renderBlockingForm(initialWeights: Record<string, number> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MatchPreferencesForm
        mode="blocking"
        initialWeights={initialWeights}
        onSave={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe("MatchPreferencesForm blocking mode", () => {
  it("disables save when weights total 85%", () => {
    renderBlockingForm({ skills: 50, location: 35 });
    expect(screen.getByRole("button", { name: /save matching preferences/i })).toBeDisabled();
  });

  it("disables save when Skills is at or below 20%", () => {
    renderBlockingForm({ skills: 20, location: 80 });
    expect(screen.getByRole("button", { name: /save matching preferences/i })).toBeDisabled();
  });

  it("enables save when Skills is above 20% and total is exactly 100%", () => {
    renderBlockingForm({ skills: 21, location: 79 });
    expect(screen.getByRole("button", { name: /save matching preferences/i })).not.toBeDisabled();
  });

  it("offers no cancel or dismiss control in blocking mode", () => {
    renderBlockingForm();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });
});
