import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  BriefcaseBusiness,
  Building2,
  Check,
  FileSearch,
  FileText,
  MousePointerClick,
  Search,
  Sparkles,
  Target,
  UserRoundCheck,
} from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";

const ease = [0.22, 1, 0.36, 1] as const;

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

const features = [
  {
    icon: FileSearch,
    title: "Understand your resume",
    text: "Turn the information already in your CV into a clear, structured career profile.",
    points: ["Skills and experience signals", "Readable profile context"],
  },
  {
    icon: Target,
    title: "Evaluate relevant roles",
    text: "Compare your profile with a role and see the context behind the match.",
    points: ["Role requirements in one view", "Practical match insights"],
  },
  {
    icon: MousePointerClick,
    title: "Keep applications moving",
    text: "Reuse your details, track activity, and keep the next step visible.",
    points: ["Supported form assistance", "Focused application tracking"],
  },
];

const steps = [
  { icon: FileText, label: "01", title: "Add your resume", text: "Start with the CV you already have." },
  { icon: Search, label: "02", title: "Explore opportunities", text: "Find roles with your career context in mind." },
  { icon: UserRoundCheck, label: "03", title: "Take the next step", text: "Track decisions and prepare with confidence." },
];

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={reveal}
      className="max-w-2xl"
    >
      <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] text-white sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-300">{copy}</p>
    </motion.div>
  );
}

function ProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.18, ease }}
      className="relative mx-auto w-full max-w-[34rem]"
    >
      <div className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-r from-violet-500/35 via-blue-500/25 to-fuchsia-500/30 blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#131b3d]/90 p-3 shadow-2xl shadow-blue-950/45 backdrop-blur-xl sm:p-4">
        <div className="rounded-[1.25rem] bg-[#0e1633] p-5 text-white sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500"><BriefcaseBusiness className="h-4 w-4" /></span>
              <div><p className="text-sm font-semibold">Example career workspace</p><p className="text-[11px] text-white/55">Profile overview</p></div>
            </div>
            <span className="rounded-full bg-blue-300/15 px-2.5 py-1 text-[10px] font-semibold text-blue-200">Ready</span>
          </div>
          <div className="mt-6 rounded-2xl bg-white/[.09] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs text-white/55">Profile strength</p><p className="mt-1 text-xl font-semibold">Frontend Engineer</p><p className="mt-1 text-xs text-white/55">React · TypeScript · Remote</p></div>
              <span className="grid h-12 w-12 place-items-center rounded-full border-[5px] border-violet-300 border-r-[#0e1633] text-xs font-bold">82%</span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-2xl bg-white/[.09] p-4">
              <div className="flex items-center justify-between"><p className="text-xs text-white/55">Recommended role</p><span className="text-xs font-semibold text-blue-200">89% fit</span></div>
              <p className="mt-3 text-sm font-semibold">Product Designer</p>
              <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-1.5 w-[89%] rounded-full bg-gradient-to-r from-violet-300 to-blue-300" /></div>
              <p className="mt-3 text-xs leading-5 text-white/55">Relevant skills and role context in one view.</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-400/30 to-blue-400/20 p-4">
              <AudioLines className="h-5 w-5 text-violet-100" />
              <p className="mt-5 text-sm font-semibold">Ask JobAI</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Get focused support when you need it.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Index() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080d21] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-36 -top-24 h-[34rem] w-[34rem] rounded-full bg-violet-600/25 blur-[110px]" />
        <div className="absolute right-[-13rem] top-[27rem] h-[31rem] w-[31rem] rounded-full bg-blue-500/20 blur-[120px]" />
      </div>

      <header className="px-4 pt-4 sm:px-6">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#111936]/75 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl sm:px-5" aria-label="Main navigation">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="JobAI Scout home">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <div className="hidden items-center gap-1 text-sm md:flex">
            <a href="#features" className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">Features</a>
            <a href="#workflow" className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">How it works</a>
            <Link to="/register?role=recruiter" className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white">For recruiters</Link>
            <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-violet-200 transition hover:bg-white/10">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 font-semibold text-white shadow-sm shadow-violet-500/30 transition hover:from-violet-500 hover:to-blue-500">Get started</Link>
          </div>
          <Link to="/register" className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-2 text-sm font-semibold text-white md:hidden">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="text-center lg:text-left">
          <motion.p variants={reveal} className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200"><Sparkles className="h-3.5 w-3.5" /> AI-powered career intelligence</motion.p>
          <motion.h1 variants={reveal} className="mt-6 max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.07em] sm:text-6xl lg:text-[4.25rem]">Make your next career move <span className="bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent">with clarity.</span></motion.h1>
          <motion.p variants={reveal} className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">One workspace for your resume, relevant opportunities, and every application decision that follows.</motion.p>
          <motion.div variants={reveal} className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link to="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-blue-500">Create a job-seeker workspace <ArrowRight className="h-4 w-4" /></Link>
            <a href="#workflow" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-blue-100 transition hover:bg-white/10">See how it works <Search className="h-4 w-4" /></a>
          </motion.div>
          <motion.div variants={reveal} className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-300 lg:justify-start">
            {["Resume intelligence", "Role context", "Application tracking"].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-violet-300" />{item}</span>)}
          </motion.div>
        </motion.div>
        <ProductPreview />
      </section>

      <section className="border-y border-white/10 bg-[#0c1330]/70 py-7">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row sm:px-8 sm:text-left">
          <p className="text-sm font-medium text-slate-300">A focused job search starts with the opportunities you choose to track.</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-[.13em] text-violet-300/80"><span>Resume</span><span>Relevant roles</span><span>Applications</span></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20" aria-label="Choose your workspace">
        <div className="rounded-[2rem] border border-white/10 bg-[#111936]/75 p-6 shadow-xl shadow-black/20 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Built for both sides of the search</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Choose the workspace that matches your goal.</h2></div>
            <p className="max-w-md text-sm leading-6 text-slate-300">Your account type sets up the right starting point. You can create either workspace in under a minute.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link to="/register" className="group rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-blue-500/10 p-6 transition hover:border-violet-300/60 hover:bg-violet-500/20">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white"><BriefcaseBusiness className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-semibold">I am looking for work</h3><p className="mt-2 text-sm leading-6 text-slate-300">Build a profile, organise suitable roles, and keep applications moving.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Create job-seeker account <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
            <Link to="/register?role=recruiter" className="group rounded-2xl border border-white/10 bg-[#0c1330] p-6 transition hover:border-blue-300/50 hover:bg-blue-500/10">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 text-blue-200"><Building2 className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-semibold">I am hiring</h3><p className="mt-2 text-sm leading-6 text-slate-300">Set up your company profile, publish roles, and manage candidates.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-200">Create recruiter account <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><SectionTitle eyebrow="What JobAI Scout helps you do" title="Less searching noise. More useful progress." copy="Every tool is designed to make the next decision easier to understand and act on." /><Link to="/register" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-violet-200 transition hover:text-white">Explore the workspace <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">{features.map((feature, index) => { const Icon = feature.icon; return <motion.article key={feature.title} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={reveal} transition={{ delay: index * 0.08 }} className="rounded-3xl border border-white/10 bg-[#111936]/75 p-7 shadow-xl shadow-black/20"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Icon className="h-5 w-5" /></span><h3 className="mt-7 text-xl font-semibold tracking-[-.03em]">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{feature.text}</p><ul className="mt-6 space-y-2.5 border-t border-white/10 pt-5">{feature.points.map((point) => <li key={point} className="flex items-center gap-2 text-sm text-slate-200"><Check className="h-4 w-4 shrink-0 text-violet-300" />{point}</li>)}</ul></motion.article>; })}</div>
      </section>

      <section id="workflow" className="border-y border-white/10 bg-[#0c1330] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-200">A simple workflow</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">From resume to next step, without the clutter.</h2><p className="mt-4 text-base leading-7 text-white/65">A focused sequence replaces the scattered tabs, repeated entry, and unclear follow-ups of a typical job search.</p></div><div className="mt-12 grid gap-4 lg:grid-cols-3">{steps.map((step, index) => { const Icon = step.icon; return <motion.article key={step.label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08, ease }} className="rounded-3xl border border-white/10 bg-[#151e42] p-7"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Icon className="h-5 w-5" /></span><span className="text-sm font-semibold text-white/40">{step.label}</span></div><h3 className="mt-8 text-xl font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{step.text}</p></motion.article>; })}</div></div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <SectionTitle eyebrow="Practical support when you need it" title="Career help that stays in context." copy="Ask about a role, your resume, or interview preparation without losing the information you have already gathered." />
        <div className="rounded-[2rem] border border-white/10 bg-[#111936]/75 p-6 shadow-xl shadow-black/20 sm:p-8"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white"><AudioLines className="h-5 w-5" /></span><div><p className="text-sm font-semibold">JobAI assistant</p><p className="mt-1 text-sm leading-6 text-slate-400">What should I focus on before this interview?</p></div></div><div className="mt-7 rounded-2xl border border-violet-400/15 bg-violet-500/10 p-5 text-sm leading-6 text-slate-200">Start with the role requirements that are most relevant to your experience, then prepare two concise examples that show how you delivered a similar outcome.</div><Link to="/register" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Meet the assistant <ArrowRight className="h-4 w-4" /></Link></div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28"><div className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-[#25165d] via-[#263f99] to-[#175a9e] px-6 py-16 text-center text-white shadow-2xl shadow-violet-950/45 sm:px-12 sm:py-20"><div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" /><div className="relative mx-auto max-w-2xl"><Sparkles className="mx-auto h-6 w-6 text-violet-100" /><h2 className="mt-6 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Ready to make your next move clearer?</h2><p className="mt-4 text-base leading-7 text-white/80">Set up your career workspace and begin with the resume you already have.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#2f2c7d] transition hover:bg-violet-50">I am looking for work <ArrowRight className="h-4 w-4" /></Link><Link to="/register?role=recruiter" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">I am hiring <Building2 className="h-4 w-4" /></Link></div></div></div></section>

      <footer className="border-t border-white/10 bg-[#0c1330] py-9"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 text-sm sm:px-8 md:flex-row md:items-center md:justify-between"><JobAILogo markClassName="h-8 w-8" /><div className="flex flex-wrap gap-x-5 gap-y-2 text-slate-300"><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/login">Sign in</Link><Link to="/register">Get started</Link></div><p className="text-xs text-slate-500">© 2026 JobAI Scout</p></div></footer>
    </main>
  );
}
