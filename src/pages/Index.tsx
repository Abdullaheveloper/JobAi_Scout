import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { CookieSettingsLink } from "@/components/CookieConsentBanner";
import { NavAppearanceControls } from "@/components/NavAppearanceControls";
import { useLandingHeroMetrics } from "@/hooks/useLandingHeroMetrics";
import { MixedDir } from "@/components/MixedDir";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";
import "./LandingRedesign.css";

const RAIL_DOTS = [
  { pct: 0.06, top: "0%", labelKey: "landing.railResume" as const },
  { pct: 0.38, top: "38%", labelKey: "landing.railExplore" as const },
  { pct: 0.68, top: "68%", labelKey: "landing.railDecide" as const },
  { pct: 0.94, top: "100%", labelKey: "landing.railNextRole" as const },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Index() {
  const { t, i18n } = useTranslation();
  const metrics = useLandingHeroMetrics();
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railPct, setRailPct] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const sheetSide = isRtlLocale(resolveLocale(i18n.resolvedLanguage || i18n.language))
    ? "left"
    : "right";

  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 40);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;
      setRailPct(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll(".reveal, .feature-card");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      nodes.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.18 },
    );
    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const stack = stackRef.current;
    if (!stage || !stack) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduceMotion || !finePointer) return;

    const onMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      stack.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`;
    };
    const onLeave = () => {
      stack.style.transform = "rotateY(0deg) rotateX(0deg)";
    };

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const features = [
    {
      title: t("landing.feature1Title"),
      text: t("landing.feature1Text"),
      points: [t("landing.feature1Point1"), t("landing.feature1Point2")],
      delay: undefined as string | undefined,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 2h9l5 5v15H6z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      title: t("landing.feature2Title"),
      text: t("landing.feature2Text"),
      points: [t("landing.feature2Point1"), t("landing.feature2Point2")],
      delay: "0.08s",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: t("landing.feature3Title"),
      text: t("landing.feature3Text"),
      points: [t("landing.feature3Point1"), t("landing.feature3Point2")],
      delay: "0.16s",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 3 14h7l-1 8 10-12h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const steps = [
    { num: "01", coord: "N 34.02°", title: t("landing.step1Title"), text: t("landing.step1Text"), delay: undefined as string | undefined },
    { num: "02", coord: "N 34.18°", title: t("landing.step2Title"), text: t("landing.step2Text"), delay: "0.08s" },
    { num: "03", coord: "N 34.31°", title: t("landing.step3Title"), text: t("landing.step3Text"), delay: "0.16s" },
  ];

  const matchBadge =
    metrics.matchPct != null
      ? t("landing.previewFitBadge", { pct: metrics.matchPct })
      : metrics.isLive
        ? t("landing.previewMatchPending")
        : t("landing.previewFit");
  const appsBadge = t("landing.previewActiveBadge", {
    count: metrics.activeApplications ?? (metrics.isLive ? 0 : 3),
  });
  const profileLabel = metrics.isLive ? metrics.profileLabel : t("landing.previewRole");
  const profileStack = metrics.isLive ? metrics.profileStack : t("landing.previewStack");
  const matchTitle =
    metrics.isLive && metrics.matchPct != null ? metrics.matchTitle : t("landing.previewDesigner");

  return (
    <main className="landing-redesign" ref={rootRef}>
      <svg className="contour-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-50,120 C 200,80 400,180 650,120 S 1100,60 1300,140" stroke="#14b8a6" strokeWidth="1" fill="none" />
        <path d="M-50,320 C 250,260 500,380 750,300 S 1150,260 1350,340" stroke="#14b8a6" strokeWidth="1" fill="none" />
        <path d="M-50,560 C 220,510 480,610 720,540 S 1120,500 1350,580" stroke="#0369a1" strokeWidth="1" fill="none" />
        <path d="M-50,800 C 260,740 520,840 780,770 S 1150,730 1360,820" stroke="#0f766e" strokeWidth="1" fill="none" />
      </svg>

      <div className="trail-rail" aria-hidden="true">
        <div className="track" />
        <div className="fill" style={{ height: `${railPct * 100}%` }} />
        {RAIL_DOTS.map((dot) => (
          <div
            key={dot.labelKey}
            className={`rail-dot${railPct >= dot.pct ? " lit" : ""}`}
            style={{ top: dot.top }}
          >
            <span className="rail-label">{t(dot.labelKey)}</span>
          </div>
        ))}
      </div>

      <nav className={`lr-nav${navScrolled ? " scrolled" : ""}`} aria-label={t("brand.homeAria")}>
        <div className="wrap nav-row">
          <Link to="/" className="logo" aria-label={t("brand.homeAria")}>
            <JobAILogo markClassName="h-[30px] w-[30px]" />
          </Link>
          <div className="nav-links">
            <a href="#features">{t("nav.features")}</a>
            <a href="#workflow">{t("nav.howItWorks")}</a>
            <a href="#recruiters">{t("nav.forRecruiters")}</a>
            <Link to="/login">{t("common.signIn")}</Link>
          </div>
          <div className="nav-cta">
            <NavAppearanceControls inlineFrom="md" />
            <Link to="/register" className="btn btn-primary btn-sm nav-primary-cta">
              {t("common.getStarted")}
            </Link>
            <button
              type="button"
              className="nav-menu-btn"
              aria-label={t("common.openMenu")}
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </nav>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          id="landing-mobile-nav"
          side={sheetSide}
          className="landing-mobile-sheet w-[min(20rem,88vw)]"
        >
          <SheetHeader className="text-start">
            <SheetTitle>{t("common.menu")}</SheetTitle>
          </SheetHeader>
          <nav className="mt-8 flex flex-col gap-1" aria-label={t("common.menu")}>
            <a href="#features" className="landing-mobile-link" onClick={closeMobileNav}>
              {t("nav.features")}
            </a>
            <a href="#workflow" className="landing-mobile-link" onClick={closeMobileNav}>
              {t("nav.howItWorks")}
            </a>
            <a href="#recruiters" className="landing-mobile-link" onClick={closeMobileNav}>
              {t("nav.forRecruiters")}
            </a>
            <Link to="/login" className="landing-mobile-link" onClick={closeMobileNav}>
              {t("common.signIn")}
            </Link>
            <Link
              to="/register"
              className="landing-mobile-cta btn btn-primary"
              onClick={closeMobileNav}
            >
              {t("common.getStarted")}
            </Link>
          </nav>
        </SheetContent>
      </Sheet>

      <header className="hero wrap">
        <div>
          <div className="eyebrow">{t("landing.heroEyebrow")}</div>
          <h1>
            {t("landing.heroTitle")} <em>{t("landing.heroTitleAccent")}</em>
          </h1>
          <p className="hero-sub">{t("landing.heroSubtitle")}</p>
          <div className="hero-ctas">
            <Link to="/register" className="btn btn-primary">
              {t("landing.ctaStartWorkspace")}
            </Link>
            <a href="#workflow" className="btn btn-ghost">
              {t("landing.ctaSeeHow")}
            </a>
          </div>
          <div className="trust-row">
            <span>
              <CheckIcon />
              {t("landing.proofResume")}
            </span>
            <span>
              <CheckIcon />
              {t("landing.proofRoles")}
            </span>
            <span>
              <CheckIcon />
              {t("landing.proofApps")}
            </span>
          </div>
        </div>

        <div className="stage" ref={stageRef}>
          <div className="stack" ref={stackRef}>
            <div className="orbit-dot" style={{ top: 200, left: 200, animationDelay: "0s" }} />
            <div className="orbit-dot" style={{ top: 200, left: 200, animationDelay: "-5s" }} />

            <div className="glass-card card-a">
              <div className="waypoint-label">
                {t("landing.waypointResume")}
                <span className="badge">
                  {metrics.profileReady ? t("landing.previewReady") : t("landing.previewBuilding")}
                </span>
              </div>
              <h4>{t("landing.previewStrength")}</h4>
              <p>
                <MixedDir>
                  {profileLabel} · {profileStack}
                </MixedDir>
              </p>
              <div className="metric">{metrics.profileStrength}%</div>
            </div>

            <div className="glass-card card-b">
              <div className="waypoint-label">
                {t("landing.waypointMatch")}
                <span className="badge">{matchBadge}</span>
              </div>
              <h4>
                <MixedDir>{matchTitle}</MixedDir>
              </h4>
              <p>
                <MixedDir>{t("landing.previewInsight")}</MixedDir>
              </p>
            </div>

            <div className="glass-card card-c">
              <div className="waypoint-label">
                {t("landing.waypointApply")}
                <span className="badge">{appsBadge}</span>
              </div>
              <h4>{t("landing.previewAsk")}</h4>
              <p>
                <MixedDir>{t("landing.previewAskText")}</MixedDir>
              </p>
            </div>
          </div>
          <div className="hero-waypoint">
            <span className="dot" />
            {t("landing.heroRoute")}
          </div>
        </div>
      </header>

      <div className="legend-strip">
        <div className="wrap legend-row">
          <p>{t("landing.bannerText")}</p>
          <div className="legend-tags">
            <span>
              <b>01</b> {t("landing.bannerResume")}
            </span>
            <span>
              <b>02</b> {t("landing.bannerRoles")}
            </span>
            <span>
              <b>03</b> {t("landing.bannerApplications")}
            </span>
          </div>
        </div>
      </div>

      <section id="features" className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">{t("landing.featuresEyebrow")}</div>
          <h2>{t("landing.featuresTitle")}</h2>
          <p>{t("landing.featuresCopy")}</p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="feature-card reveal"
              style={feature.delay ? { transitionDelay: feature.delay } : undefined}
            >
              <div className="waypoint-dot-abs" />
              <div className="icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>
                <MixedDir>{feature.text}</MixedDir>
              </p>
              <div className="checks">
                {feature.points.map((point) => (
                  <span key={point}>
                    <CheckIcon />
                    <MixedDir>{point}</MixedDir>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="wrap">
        <div className="section-head-row reveal">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="eyebrow">{t("landing.workflowEyebrow")}</div>
            <h2>{t("landing.workflowTitle")}</h2>
          </div>
          <p style={{ color: "var(--lr-paper-dim)", fontSize: 15, maxWidth: 320 }}>{t("landing.workflowCopy")}</p>
        </div>

        <div className="workflow-grid" style={{ marginTop: 56 }}>
          {steps.map((step) => (
            <article
              key={step.num}
              className="waypoint-card reveal"
              style={step.delay ? { transitionDelay: step.delay } : undefined}
            >
              <div className="waypoint-connector" />
              <div className="coord">
                <span className="num">{step.num}</span>
                <span>{step.coord}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="assistant-wrap">
          <div className="reveal">
            <div className="eyebrow">{t("landing.assistantEyebrow")}</div>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,36px)", color: "var(--lr-paper)", lineHeight: 1.18 }}>
              {t("landing.assistantTitle")}
            </h2>
            <p style={{ marginTop: 16, color: "var(--lr-paper-dim)", fontSize: 15.5, maxWidth: 400, lineHeight: 1.65 }}>
              {t("landing.assistantCopy")}
            </p>
          </div>
          <div className="assistant-card reveal" style={{ transitionDelay: "0.1s" }}>
            <div className="assistant-head">
              <div className="assistant-avatar">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2 3 7v10l9 5 9-5V7z" stroke="#041512" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>{t("landing.assistantName")}</b>
                <div className="q">{t("landing.assistantSampleQ")}</div>
              </div>
            </div>
            <div className="assistant-bubble">{t("landing.assistantSampleA")}</div>
            <Link to="/register" className="assistant-cta">
              {t("landing.meetAssistant")} →
            </Link>
          </div>
        </div>
      </section>

      <section id="recruiters" className="wrap">
        <div className="path-grid">
          <Link to="/register" className="path-card seeker reveal">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16v13H4z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 7V5a3 3 0 013-3v0a3 3 0 013 3v2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <h3>{t("landing.seekerTitle")}</h3>
            <p>{t("landing.seekerText")}</p>
            <span className="link">{t("landing.seekerCta")} →</span>
          </Link>
          <Link to="/register?role=recruiter" className="path-card recruit reveal" style={{ transitionDelay: "0.08s" }}>
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 21V9l8-5 8 5v12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
            <h3>{t("landing.recruiterTitle")}</h3>
            <p>{t("landing.recruiterText")}</p>
            <span className="link">{t("landing.recruiterCta")} →</span>
          </Link>
        </div>
      </section>

      <section className="wrap">
        <div className="final-cta reveal">
          <div className="compass-icon">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="14.5" stroke="#2dd4bf" strokeWidth="1.4" />
              <path d="M16 6 L20 16 L16 26 L12 16 Z" fill="#0f766e" />
            </svg>
          </div>
          <h2>{t("landing.ctaTitle")}</h2>
          <p>{t("landing.ctaCopy")}</p>
          <div className="hero-ctas">
            <Link to="/register" className="btn btn-primary">
              {t("landing.seekerTitle")} →
            </Link>
            <Link to="/register?role=recruiter" className="btn btn-ghost">
              {t("landing.recruiterTitle")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="lr-footer wrap">
        <div className="footer-row">
          <Link to="/" className="logo" aria-label={t("brand.homeAria")}>
            <JobAILogo markClassName="h-8 w-8" />
          </Link>
          <div className="footer-links">
            <a href="#features">{t("nav.features")}</a>
            <Link to="/privacy">{t("common.privacyPolicy")}</Link>
            <CookieSettingsLink />
            <Link to="/contact">{t("common.contact")}</Link>
            <Link to="/about">{t("common.about")}</Link>
            <Link to="/login">{t("common.signIn")}</Link>
            <Link to="/register">{t("common.getStarted")}</Link>
          </div>
          <div className="footer-coord">{t("landing.footerCoord")}</div>
        </div>
        <p className="footer-coord" style={{ marginTop: 24 }}>
          {t("landing.copyright")}
        </p>
      </footer>
    </main>
  );
}
