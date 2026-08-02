import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantWorkspaceShell } from "@/components/assistant/AssistantWorkspaceShell";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "user" }) }));

let mobile = false;

beforeEach(() => {
  mobile = false;
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: class {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
    },
  });
});

describe("AssistantWorkspaceShell", () => {
  it("opens beside the existing routed content and closes again", () => {
    render(<MemoryRouter><AssistantWorkspaceShell><div data-testid="current-page" /></AssistantWorkspaceShell></MemoryRouter>);

    expect(screen.getByTestId("current-page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.open" }));
    expect(screen.getByRole("complementary", { name: "assistantShell.panel" })).toBeInTheDocument();
    expect(screen.getByTestId("current-page")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "assistantShell.close" })[0]);
    expect(screen.queryByRole("complementary", { name: "assistantShell.panel" })).not.toBeInTheDocument();
  });

  it("keeps the composer sticky while only the message list scrolls", () => {
    render(<MemoryRouter><AssistantWorkspaceShell><div /></AssistantWorkspaceShell></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.open" }));
    expect(screen.getByTestId("assistant-message-list")).toHaveClass("flex-1", "overflow-y-auto", "pb-6");
    expect(screen.getByTestId("assistant-composer")).toHaveClass("sticky", "bottom-0", "shrink-0");
    expect(screen.getByRole("complementary", { name: "assistantShell.panel" })).toHaveClass("overflow-hidden");
  });

  it("resizes within desktop bounds and persists the selected ratio", () => {
    render(<MemoryRouter><AssistantWorkspaceShell><div data-testid="live-site" /></AssistantWorkspaceShell></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.open" }));
    const separator = screen.getByRole("separator", { name: "assistantShell.resize" });
    for (let step = 0; step < 20; step += 1) fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "60");
    expect(Number(window.localStorage.getItem("jobai-assistant-desktop-ratio"))).toBe(60);
  });

  it("uses a horizontal separator and vertical ratio on mobile", () => {
    mobile = true;
    render(<MemoryRouter><AssistantWorkspaceShell><div data-testid="mobile-live-site" /></AssistantWorkspaceShell></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.open" }));

    const separator = screen.getByRole("separator", { name: "assistantShell.resize" });
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("region", { name: "assistantShell.liveSite" })).toHaveStyle({ height: "70%" });
    expect(screen.getByRole("complementary", { name: "assistantShell.panel" })).toHaveStyle({ height: "30%" });
  });

  it("starts listening from the mic and stops locally without an agent request", () => {
    render(<MemoryRouter><AssistantWorkspaceShell><div data-testid="voice-live-site" /></AssistantWorkspaceShell></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.open" }));
    fireEvent.click(screen.getByRole("button", { name: "assistantShell.microphone" }));
    expect(screen.getByText("assistantShell.state_listening")).toBeInTheDocument();

    const stopButton = screen.getByRole("button", { name: "assistantShell.stop" });
    expect(stopButton).toBeEnabled();
    fireEvent.click(stopButton);
    expect(screen.getByText("assistantShell.state_idle")).toBeInTheDocument();
  });
});
