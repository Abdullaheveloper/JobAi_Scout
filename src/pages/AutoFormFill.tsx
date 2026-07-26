import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  BriefcaseBusiness,
  Chrome,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";

const installSteps = [
  {
    number: "1",
    title: "Download the package",
    description: "Click Download extension above to get job-form-fill.zip, then extract the folder.",
  },
  {
    number: "2",
    title: "Open Chrome extensions",
    description: "Go to chrome://extensions (or edge://extensions) and turn on Developer mode.",
  },
  {
    number: "3",
    title: "Load unpacked",
    description: "Choose Load unpacked and select the extracted folder. Sign in with your JobAI Scout account.",
  },
];

const filledData = [
  { label: "Name", Icon: UserRound },
  { label: "Email", Icon: Mail },
  { label: "Phone", Icon: Phone },
  { label: "Location", Icon: MapPin },
  { label: "Experience", Icon: BriefcaseBusiness },
  { label: "Education", Icon: GraduationCap },
  { label: "Resume details", Icon: FileText },
];

export default function AutoFormFill() {
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "error">("idle");

  const handleDownload = async () => {
    setDownloadState("loading");

    try {
      const response = await fetch("/job-form-fill.zip");
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "job-form-fill.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setDownloadState("idle");
    } catch (error) {
      console.error("Extension download failed", error);
      setDownloadState("error");
    }
  };

  const downloadLabel = downloadState === "loading" ? "Preparing download..." : "Download extension";

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl space-y-8 pb-10 pt-1 animate-fade-in" aria-labelledby="autofill-title">
        {/* Section 1 — Download */}
        <section className="relative isolate overflow-hidden rounded-[28px] border border-indigo-300/20 bg-[#080f2a] px-5 py-8 shadow-[0_25px_80px_rgba(2,8,23,0.5)] sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_9%_9%,rgba(99,102,241,0.30),transparent_30%),radial-gradient(circle_at_91%_24%,rgba(139,92,246,0.24),transparent_28%),linear-gradient(145deg,rgba(15,23,66,0.88),rgba(4,9,28,0.96))]" />
          <div className="pointer-events-none absolute -right-20 top-8 -z-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-300/25 bg-indigo-400/10 text-indigo-200">
            <Chrome className="h-5 w-5" aria-hidden="true" />
          </div>

          <h1 id="autofill-title" className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Job Form Fill
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
            Download the browser extension to auto-fill job applications with your Career Passport data.
          </p>

          <div className="mt-7">
            <Button
              onClick={handleDownload}
              disabled={downloadState === "loading"}
              size="lg"
              className="gradient-primary h-12 rounded-xl px-5 font-semibold shadow-[0_12px_30px_rgba(99,102,241,0.32)] hover:brightness-110"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloadLabel}
            </Button>
          </div>

          <p aria-live="polite" className="mt-3 min-h-5 text-xs text-slate-400">
            {downloadState === "error"
              ? "The extension package could not be downloaded. Please try again."
              : "Works with Chrome, Edge, and other Chromium browsers."}
          </p>
        </section>

        {/* Section 2 — How to install */}
        <section className="space-y-4" aria-labelledby="install-title">
          <div>
            <h2 id="install-title" className="font-display text-2xl font-bold tracking-tight text-slate-100">
              How to install
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-400">
              Three quick steps to get the extension running in your browser.
            </p>
          </div>

          <ol className="space-y-3">
            {installSteps.map((step) => (
              <li
                key={step.number}
                className="flex gap-4 rounded-2xl border border-white/8 bg-card/80 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 font-mono text-sm font-semibold text-indigo-200">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Section 3 — What data gets filled */}
        <section className="space-y-4" aria-labelledby="data-title">
          <div>
            <h2 id="data-title" className="font-display text-2xl font-bold tracking-tight text-slate-100">
              What data gets filled
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-400">
              The extension uses facts from your Career Passport profile — nothing invented, nothing guessed.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-card/80 p-5">
            {filledData.map(({ label, Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-slate-950/25 px-2.5 py-2 text-xs font-medium text-slate-300"
              >
                <Icon className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <p className="px-1 text-xs leading-5 text-slate-500">
            Sensitive questions (legal, diversity, consent) and final submission always stay with you.
          </p>
        </section>
      </main>
    </DashboardLayout>
  );
}
