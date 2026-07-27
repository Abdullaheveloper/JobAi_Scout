import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { BidiText } from "@/components/BidiText";
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

export default function AutoFormFill() {
  const { t } = useTranslation();
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "error">("idle");

  const installSteps = [
    { number: "1", title: t("formFill.step1Title"), description: t("formFill.step1Desc") },
    { number: "2", title: t("formFill.step2Title"), description: t("formFill.step2Desc") },
    { number: "3", title: t("formFill.step3Title"), description: t("formFill.step3Desc") },
  ];

  const filledData = [
    { label: t("formFill.dataName"), Icon: UserRound },
    { label: t("formFill.dataEmail"), Icon: Mail },
    { label: t("formFill.dataPhone"), Icon: Phone },
    { label: t("formFill.dataLocation"), Icon: MapPin },
    { label: t("formFill.dataExperience"), Icon: BriefcaseBusiness },
    { label: t("formFill.dataEducation"), Icon: GraduationCap },
    { label: t("formFill.dataResume"), Icon: FileText },
  ];

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

  const downloadLabel = downloadState === "loading" ? t("formFill.downloading") : t("formFill.downloadExtension");

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl space-y-8 pb-10 pt-1 animate-fade-in" aria-labelledby="autofill-title">
        <section className="relative isolate overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-5 py-8 shadow-card sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -end-20 top-8 -z-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200">
            <Chrome className="h-5 w-5" aria-hidden="true" />
          </div>

          <h1 id="autofill-title" className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("formFill.title")}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            <BidiText text={t("formFill.subtitle")} />
          </p>

          <div className="mt-7">
            <Button
              onClick={handleDownload}
              disabled={downloadState === "loading"}
              size="lg"
              className="gradient-primary h-12 rounded-xl px-5 font-semibold text-white shadow-[0_12px_30px_rgba(99,102,241,0.32)] hover:brightness-110"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloadLabel}
            </Button>
          </div>

          <p aria-live="polite" className="mt-3 min-h-5 text-xs text-muted-foreground">
            {downloadState === "error" ? t("formFill.downloadFailed") : t("formFill.browserCompat")}
          </p>
        </section>

        <section className="space-y-4" aria-labelledby="install-title">
          <div>
            <h2 id="install-title" className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t("formFill.installTitle")}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              <BidiText text={t("formFill.installSubtitle")} />
            </p>
          </div>

          <ol className="space-y-3">
            {installSteps.map((step) => (
              <li
                key={step.number}
                className="flex gap-4 rounded-2xl border border-border bg-card/80 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 font-mono text-sm font-semibold text-indigo-700 dark:text-indigo-200" dir="ltr">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    <BidiText text={step.title} />
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    <BidiText text={step.description} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4" aria-labelledby="data-title">
          <div>
            <h2 id="data-title" className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t("formFill.dataTitle")}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              <BidiText text={t("formFill.dataSubtitle")} />
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card/80 p-5">
            {filledData.map(({ label, Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-xs font-medium text-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                <BidiText text={label} />
              </span>
            ))}
          </div>

          <p className="px-1 text-xs leading-5 text-muted-foreground">
            <BidiText text={t("formFill.sensitiveNote")} />
          </p>
        </section>
      </main>
    </DashboardLayout>
  );
}
