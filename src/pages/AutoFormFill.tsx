import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Chrome,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Github,
  Globe2,
  GraduationCap,
  Landmark,
  Lightbulb,
  Linkedin,
  LockKeyhole,
  Mail,
  MapPin,
  MousePointer2,
  Phone,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from "lucide-react";

type DecisionKind = "fill" | "review" | "manual";

const decisionStyles: Record<DecisionKind, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  fill: {
    label: "Auto-fill",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    Icon: CheckCircle2,
  },
  review: {
    label: "Suggest for review",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    Icon: Lightbulb,
  },
  manual: {
    label: "You decide",
    className: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    Icon: LockKeyhole,
  },
};

const passportGroups = [
  {
    title: "Identity & contact",
    description: "Only facts you have saved to your Career Passport.",
    decision: "fill" as const,
    fields: [
      { label: "Name", Icon: UserRound },
      { label: "Email", Icon: Mail },
      { label: "Phone", Icon: Phone },
      { label: "Location", Icon: MapPin },
    ],
  },
  {
    title: "Career evidence",
    description: "Skills, education, experience, links, and resume details are matched to compatible form fields.",
    decision: "fill" as const,
    fields: [
      { label: "Experience", Icon: BriefcaseBusiness },
      { label: "Education", Icon: GraduationCap },
      { label: "LinkedIn", Icon: Linkedin },
      { label: "Portfolio", Icon: Globe2 },
      { label: "GitHub", Icon: Github },
      { label: "Resume", Icon: FileText },
    ],
  },
  {
    title: "Contextual answers",
    description: "Useful matches are surfaced when wording is unclear, missing, or needs your judgment.",
    decision: "review" as const,
    fields: [
      { label: "Role preference", Icon: ScanSearch },
      { label: "Work authorization", Icon: ShieldCheck },
      { label: "Availability", Icon: Landmark },
      { label: "Salary expectation", Icon: FileCheck2 },
    ],
  },
];

const safetyRules = [
  "Terms, privacy policy, consent, final submission, and CAPTCHAs always remain yours.",
  "Diversity, disability, veteran status, ethnicity, and other sensitive questions are never guessed or selected.",
  "The assistant will not invent experience, qualifications, dates, or answers that are not in your profile.",
  "A tailored cover letter is prepared in JobAI Scout first; it is never uploaded without your review.",
];

const setupSteps = [
  {
    number: "01",
    title: "Build your Career Passport",
    description: "Add the career facts you want reused: work history, education, links, resume, preferences, and verified details.",
    action: "Open Profile Settings",
    to: "/dashboard/settings",
  },
  {
    number: "02",
    title: "Install the extension",
    description: "Download the package, open chrome://extensions, turn on Developer mode, then choose Load unpacked.",
    action: "Download extension",
    download: true,
  },
  {
    number: "03",
    title: "Open an application you trust",
    description: "Sign in to the extension with your JobAI Scout account and open a compatible job application form.",
    action: "See browser support",
    to: "#browser-support",
  },
  {
    number: "04",
    title: "Review the fill plan",
    description: "Use the extension to fill verified facts, inspect suggestions, and complete the protected fields yourself before submitting.",
    action: "What stays manual",
    to: "#your-decision",
  },
];

function DecisionBadge({ kind }: { kind: DecisionKind }) {
  const { label, className, Icon } = decisionStyles[kind];

  return (
    <Badge variant="outline" className={`gap-1.5 border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

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
      <main className="mx-auto max-w-6xl space-y-6 pb-10 pt-1 animate-fade-in" aria-labelledby="autofill-title">
        <section className="relative isolate overflow-hidden rounded-[28px] border border-indigo-300/20 bg-[#080f2a] px-5 py-7 shadow-[0_25px_80px_rgba(2,8,23,0.5)] sm:px-8 sm:py-10 lg:px-10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_9%_9%,rgba(99,102,241,0.30),transparent_30%),radial-gradient(circle_at_91%_24%,rgba(139,92,246,0.24),transparent_28%),linear-gradient(145deg,rgba(15,23,66,0.88),rgba(4,9,28,0.96))]" />
          <div className="pointer-events-none absolute -right-20 top-8 -z-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-32 w-2/3 bg-indigo-500/10 blur-3xl" />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-end">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-indigo-300/30 bg-indigo-400/10 px-3 py-1.5 text-indigo-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Career Passport + extension
                </Badge>
                <span className="text-xs font-medium text-slate-400">Evidence-led application assistance</span>
              </div>

              <h1 id="autofill-title" className="max-w-3xl font-display text-3xl font-bold tracking-[-0.045em] text-slate-50 sm:text-4xl lg:text-5xl">
                Fill the work. <span className="text-gradient">Keep the judgment.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                JobAI Scout turns the career facts you have approved into a clear application fill plan. It fills reliable details, flags uncertain matches, and keeps sensitive decisions with you.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={handleDownload} disabled={downloadState === "loading"} size="lg" className="gradient-primary h-12 rounded-xl px-5 font-semibold shadow-[0_12px_30px_rgba(99,102,241,0.32)] hover:brightness-110">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {downloadLabel}
                </Button>
                <Button variant="outline" size="lg" className="h-12 rounded-xl border-slate-500/35 bg-slate-950/25 px-5 text-slate-100 hover:border-indigo-300/50 hover:bg-indigo-400/10 hover:text-white" asChild>
                  <Link to="/dashboard/settings">
                    Build Career Passport
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <p aria-live="polite" className="mt-3 min-h-5 text-xs text-slate-400">
                {downloadState === "error" ? "The extension package could not be downloaded. Please try again or check that the site is available." : "For Chrome, Edge, and other Chromium browsers."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Your fill plan</span>
                <Workflow className="h-4 w-4 text-indigo-300" aria-hidden="true" />
              </div>
              <div className="space-y-2.5">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verified facts</div>
                  <p className="mt-1 text-xs leading-5 text-emerald-100/65">Name, contact, links, and evidence already in your profile.</p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><Lightbulb className="h-4 w-4" aria-hidden="true" /> Review cues</div>
                  <p className="mt-1 text-xs leading-5 text-amber-100/65">Ambiguous or incomplete fields are presented for your approval.</p>
                </div>
                <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-100"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Protected choices</div>
                  <p className="mt-1 text-xs leading-5 text-rose-100/65">Legal, sensitive, and final-submission actions stay manual.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-label="How application assistance works">
          <Card className="overflow-hidden border-indigo-300/15 bg-card/80 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 border-b border-white/8 bg-gradient-to-r from-indigo-500/[0.08] to-violet-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">Precision before speed</p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">One form, three decisions</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MousePointer2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
                  You stay in control
                </div>
              </div>

              <div className="grid divide-y divide-white/7 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {(Object.keys(decisionStyles) as DecisionKind[]).map((kind) => {
                  const item = decisionStyles[kind];
                  const Icon = item.Icon;
                  const copy = kind === "fill"
                    ? "High-confidence facts from your saved profile can be placed directly in compatible fields."
                    : kind === "review"
                      ? "The extension highlights a possible answer instead of pretending it knows your intent."
                      : "Sensitive, legal, and consent decisions are shown clearly but are never selected for you.";

                  return (
                    <div key={kind} className="p-5 sm:p-6">
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${item.className}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="font-display text-base font-semibold text-slate-100">{item.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-300/15 bg-gradient-to-br from-[#101a46] to-[#0a102b] shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-slate-100">The 40% rule, used responsibly</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                A 40% match is useful as a prompt to review, not enough to make a decision for you. Non-sensitive checkboxes require explicit profile evidence and a much higher confidence before they can be selected.
              </p>
              <Link to="/dashboard/settings" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-100">
                Tune your preferences <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4" aria-labelledby="passport-fields-title">
          <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Career Passport</p>
              <h2 id="passport-fields-title" className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">Fill only what is backed by you</h2>
            </div>
            <Link to="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-100">
              Review your data <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {passportGroups.map((group) => (
              <Card key={group.title} className="group border-white/8 bg-card/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/25 hover:shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-100">{group.title}</h3>
                      <p className="mt-1.5 min-h-[60px] text-sm leading-5 text-slate-400">{group.description}</p>
                    </div>
                    <DecisionBadge kind={group.decision} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {group.fields.map(({ label, Icon }) => (
                      <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-slate-950/25 px-2.5 py-2 text-xs font-medium text-slate-300">
                        <Icon className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                        {label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card id="your-decision" className="scroll-mt-24 overflow-hidden border-rose-200/12 bg-card/80 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
            <CardContent className="p-0">
              <div className="flex items-start gap-3 border-b border-white/8 bg-rose-400/[0.045] p-5 sm:p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200/20 bg-rose-400/10 text-rose-200"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Your decision</p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">Always protected, never guessed</h2>
                </div>
              </div>
              <ul className="space-y-0 p-3 sm:p-4">
                {safetyRules.map((rule) => (
                  <li key={rule} className="flex gap-3 rounded-xl p-3 text-sm leading-6 text-slate-300">
                    <X className="mt-1 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card id="browser-support" className="scroll-mt-24 border-indigo-300/15 bg-card/80 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">Extension workflow</p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">Built for a deliberate final review</h2>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200"><Chrome className="h-5 w-5" aria-hidden="true" /></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2" aria-label="Browser support">
                {["Chrome", "Edge", "Brave"].map((browser) => (
                  <div key={browser} className="rounded-xl border border-white/8 bg-slate-950/25 px-3 py-3 text-center text-xs font-semibold text-slate-200">{browser}</div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-indigo-300/15 bg-indigo-400/[0.055] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Private by design</div>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">The extension uses your signed-in account to retrieve only the application information it needs. Keep your browser and JobAI Scout account signed out on shared devices.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="setup-guide" className="scroll-mt-24 rounded-[24px] border border-indigo-300/15 bg-gradient-to-br from-[#0e173d] via-[#0a112d] to-[#0a0d27] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.22)] sm:p-7">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">Start in four calm steps</p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-100">From Career Passport to better applications</h2>
            </div>
            <Button onClick={handleDownload} disabled={downloadState === "loading"} variant="outline" className="w-full rounded-xl border-indigo-300/30 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20 hover:text-white sm:w-auto">
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloadLabel}
            </Button>
          </div>

          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {setupSteps.map((step) => (
              <li key={step.number} className="group flex gap-4 rounded-2xl border border-white/8 bg-slate-950/20 p-4 transition-colors hover:border-indigo-300/25 hover:bg-indigo-400/[0.045]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 font-mono text-xs font-semibold text-indigo-200">{step.number}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{step.description}</p>
                  {step.download ? (
                    <button type="button" onClick={handleDownload} disabled={downloadState === "loading"} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
                      {downloadLabel} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : step.to?.startsWith("#") ? (
                    <a href={step.to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-100">
                      {step.action} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link to={step.to ?? "/dashboard/settings"} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-300 transition-colors hover:text-indigo-100">
                      {step.action} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.055] p-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Application reminder">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <p><span className="font-semibold text-slate-100">Before you submit:</span> compare every completed field with the role, read the employer’s questions, and make the final choice yourself.</p>
          </div>
          <Link to="/dashboard/settings" className="shrink-0 text-sm font-semibold text-indigo-300 hover:text-indigo-100">Review profile</Link>
        </aside>
      </main>
    </DashboardLayout>
  );
}
