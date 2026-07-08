import { Link } from "react-router-dom";
import {
  Briefcase, Sparkles, ArrowRight, Upload, Target, Zap, CheckCircle,
  ChevronLeft, ChevronRight, Mail, Shield, Brain, Globe, Rocket, Users,
  BarChart3, Star, TrendingUp, Award, ArrowDown, Check, Play,
  FileText, Cpu, MousePointerClick
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";

const InteractiveHero3D = lazy(() => import("@/components/3d/InteractiveHero3D"));
const FloatingObjects3D = lazy(() => import("@/components/3d/FloatingObjects3D"));
const ParticleSystem3D = lazy(() => import("@/components/3d/ParticleSystem3D"));
const ScrollTransition3D = lazy(() => import("@/components/3d/ScrollTransition3D"));

import slideAiResume from "@/assets/slide-ai-resume.jpg";
import slideJobMatching from "@/assets/slide-job-matching.jpg";
import slideRecruiterCrm from "@/assets/slide-recruiter-crm.jpg";
import slideOneClick from "@/assets/slide-one-click.jpg";
import slideVoiceAssistant from "@/assets/slide-voice-assistant.jpg";

/* ─── Variants ─────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

/* ─── Data ─────────────────────────────────────────────── */
const teamMembers = [
  {
    name: "Abdullah Waheed", role: "Full-Stack Developer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abdullah",
    experience: "5+ years", skills: ["React", "Node.js", "AI/ML", "Supabase"],
    bio: "Building intelligent job platforms powered by cutting-edge AI.",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    name: "Arsalan Haider", role: "UI/UX Designer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arsalan",
    experience: "4+ years", skills: ["Figma", "Tailwind", "Framer Motion", "Design Systems"],
    bio: "Crafting premium, accessible interfaces that convert and delight.",
    gradient: "from-violet-500 to-pink-600",
  },
  {
    name: "Sarah Khan", role: "AI Engineer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    experience: "6+ years", skills: ["Python", "NLP", "TensorFlow", "CV Parsing"],
    bio: "Pioneering AI-driven recruitment and semantic skill-matching.",
    gradient: "from-cyan-500 to-indigo-600",
  },
  {
    name: "Ahmed Raza", role: "Backend Architect",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed",
    experience: "7+ years", skills: ["PostgreSQL", "Deno", "APIs", "Security"],
    bio: "Building secure, scalable infrastructure for millions of job seekers.",
    gradient: "from-rose-500 to-orange-600",
  },
];

const slides = [
  { title: "AI Resume Parser", description: "Instantly extract skills, experience, and education from any CV format with 98% accuracy.", gradient: "from-blue-600 to-indigo-700", image: slideAiResume },
  { title: "Smart Job Matching", description: "94% precision AI matching connects you to roles that genuinely fit your career trajectory.", gradient: "from-violet-600 to-purple-700", image: slideJobMatching },
  { title: "Recruiter CRM", description: "Full-funnel pipeline management with Kanban boards, analytics, and real-time messaging.", gradient: "from-emerald-600 to-teal-700", image: slideRecruiterCrm },
  { title: "One-Click Apply", description: "AI-generated, personalised cover letters with auto-fill for lightning-fast applications.", gradient: "from-orange-500 to-rose-600", image: slideOneClick },
  { title: "Voice Assistant", description: "Hands-free career coaching and interview prep powered by ElevenLabs conversational AI.", gradient: "from-pink-500 to-fuchsia-600", image: slideVoiceAssistant },
];

const features = [
  { icon: Brain, title: "Semantic AI Matching", desc: "Goes beyond keywords — our NLP engine understands context, seniority, and career trajectory to surface the right roles.", color: "from-indigo-500 to-violet-600", glow: "rgba(99,102,241,0.3)", delay: 0 },
  { icon: Shield, title: "Enterprise-Grade Security", desc: "SOC 2 compliant with row-level security, end-to-end encryption, and zero third-party data sharing.", color: "from-cyan-500 to-blue-600", glow: "rgba(6,182,212,0.3)", delay: 0.1 },
  { icon: Globe, title: "Location-Aware Scraping", desc: "Jobs scraped in real time from your exact city, using location data intelligently extracted from your CV.", color: "from-emerald-500 to-teal-600", glow: "rgba(16,185,129,0.3)", delay: 0.2 },
  { icon: Rocket, title: "Sub-Second Performance", desc: "Edge-deployed functions deliver real-time results globally — no spinners, no waiting, just instant intelligence.", color: "from-orange-500 to-rose-600", glow: "rgba(244,63,94,0.3)", delay: 0.3 },
  { icon: Users, title: "Three-Role Ecosystem", desc: "Distinct, purpose-built experiences for Job Seekers, Recruiters, and Platform Admins — all in one product.", color: "from-violet-500 to-purple-600", glow: "rgba(139,92,246,0.3)", delay: 0.4 },
  { icon: BarChart3, title: "Real-Time Analytics", desc: "Track application stages, match scores, and pipeline health with live dashboards and exportable reports.", color: "from-pink-500 to-fuchsia-600", glow: "rgba(244,114,182,0.3)", delay: 0.5 },
];

const testimonials = [
  {
    name: "Aisha Malik", role: "Senior Software Engineer", company: "TechFlow Inc",
    text: "JobAI Scout surfaced three perfectly-matched roles in under 5 minutes. The AI accuracy is genuinely unlike anything I've used before.",
    rating: 5, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aisha",
    metric: "Hired in 3 weeks",
  },
  {
    name: "Omar Farooq", role: "Product Manager", company: "LaunchBase",
    text: "The voice assistant coached me through every interview answer. I landed my £90k role at a Series B startup. This platform is a game changer.",
    rating: 5, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar",
    metric: "£90k offer secured",
  },
  {
    name: "Zara Ahmed", role: "Data Scientist", company: "Quantum Analytics",
    text: "Uploaded my CV at 9 AM. By 9:05 AM I had a full skill profile, 12 matched jobs, and a personalised cover letter ready to send.",
    rating: 5, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zara",
    metric: "5 min to first apply",
  },
];

/* ─── Company Logo SVG icons ────────────────────────────── */
const companies = [
  {
    name: "Google",
    logo: (
      <svg viewBox="0 0 74 24" className="h-5 w-auto" fill="currentColor">
        <path d="M6.7 10.5v2.9h4.7c-.2 1.2-1.3 3.4-4.7 3.4-2.8 0-5.1-2.3-5.1-5.2s2.3-5.2 5.1-5.2c1.6 0 2.7.7 3.3 1.3l2.2-2.1C10.8 4.3 8.9 3.4 6.7 3.4c-4.2 0-7.6 3.4-7.6 7.6s3.4 7.6 7.6 7.6c4.4 0 7.3-3.1 7.3-7.4 0-.5-.1-.9-.1-1.2H6.7z" />
        <path d="M25.1 13.4c0 3.3-2.5 5.7-5.7 5.7s-5.7-2.4-5.7-5.7 2.5-5.7 5.7-5.7 5.7 2.4 5.7 5.7zm-2.5 0c0-2.1-1.5-3.5-3.2-3.5s-3.2 1.4-3.2 3.5 1.5 3.5 3.2 3.5 3.2-1.4 3.2-3.5z" />
        <path d="M36.8 13.4c0 3.3-2.5 5.7-5.7 5.7s-5.7-2.4-5.7-5.7 2.5-5.7 5.7-5.7 5.7 2.4 5.7 5.7zm-2.5 0c0-2.1-1.5-3.5-3.2-3.5s-3.2 1.4-3.2 3.5 1.5 3.5 3.2 3.5 3.2-1.4 3.2-3.5z" />
        <path d="M47.8 8v10.4c0 4.3-2.5 6-5.5 6-2.8 0-4.5-1.9-5.1-3.4l2.2-.9c.4.9 1.3 2 2.9 2 1.9 0 3.1-1.2 3.1-3.4v-.8h-.1c-.6.7-1.7 1.3-3 1.3-2.9 0-5.5-2.5-5.5-5.7 0-3.2 2.6-5.7 5.5-5.7 1.4 0 2.4.6 3 1.3h.1V8h2.4zm-2.3 5.4c0-2-1.4-3.5-3.1-3.5s-3.2 1.5-3.2 3.5 1.5 3.4 3.2 3.4 3.1-1.4 3.1-3.4z" />
        <path d="M52.6 3.8v15h-2.5v-15h2.5z" />
        <path d="M62.8 15.5l2 1.3c-.6 1-2.2 2.7-4.9 2.7-3.3 0-5.8-2.6-5.8-5.7 0-3.4 2.5-5.7 5.5-5.7 3 0 4.5 2.4 5 3.7l.3.6-7.8 3.2c.6 1.2 1.5 1.8 2.8 1.8 1.3 0 2.2-.6 2.9-1.9zm-6.1-2.1l5.2-2.2c-.3-.7-1.1-1.2-2.1-1.2-1.3.1-3 1.1-3.1 3.4z" />
        <path d="M9.1 23.9H7.5l-.5-1.4H4.7l-.5 1.4H2.6l2.4-6.3h1.8l2.3 6.3zm-2.4-2.6l-.8-2.2-.8 2.2h1.6z" />
        <path d="M72.1 23.9h-1.7l-1.7-2.7-1.7 2.7h-1.6l2.4-3.2-2.3-3.1H67l1.6 2.5 1.6-2.5h1.7l-2.2 3 2.4 3.3z" />
      </svg>
    ),
  },
  {
    name: "Microsoft",
    logo: (
      <svg viewBox="0 0 88 18" className="h-5 w-auto" fill="currentColor">
        <path d="M0 0h8.5v8.5H0zm9.5 0H18v8.5H9.5zM0 9.5h8.5V18H0zm9.5 0H18V18H9.5z" opacity="0.9" />
        <text x="22" y="14" fontSize="13" fontFamily="Segoe UI, sans-serif" fontWeight="300" letterSpacing="0.3">Microsoft</text>
      </svg>
    ),
  },
  {
    name: "Amazon",
    logo: (
      <svg viewBox="0 0 100 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="Amazon Ember, Arial, sans-serif" fontWeight="700" letterSpacing="-0.5">amazon</text>
      </svg>
    ),
  },
  {
    name: "Meta",
    logo: (
      <svg viewBox="0 0 60 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="Optimistic Display, Arial, sans-serif" fontWeight="700" letterSpacing="-0.3">Meta</text>
      </svg>
    ),
  },
  {
    name: "Netflix",
    logo: (
      <svg viewBox="0 0 80 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="Netflix Sans, Arial, sans-serif" fontWeight="800" letterSpacing="1">NETFLIX</text>
      </svg>
    ),
  },
  {
    name: "Spotify",
    logo: (
      <svg viewBox="0 0 80 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="15" fontFamily="Circular, Arial, sans-serif" fontWeight="700">Spotify</text>
      </svg>
    ),
  },
  {
    name: "Stripe",
    logo: (
      <svg viewBox="0 0 60 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="Camphor, Arial, sans-serif" fontWeight="600" letterSpacing="-0.3">stripe</text>
      </svg>
    ),
  },
  {
    name: "Airbnb",
    logo: (
      <svg viewBox="0 0 70 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="15" fontFamily="Cereal, Arial, sans-serif" fontWeight="700">airbnb</text>
      </svg>
    ),
  },
  {
    name: "Notion",
    logo: (
      <svg viewBox="0 0 70 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="ui-sans-serif, sans-serif" fontWeight="700" letterSpacing="-0.2">Notion</text>
      </svg>
    ),
  },
  {
    name: "Figma",
    logo: (
      <svg viewBox="0 0 60 22" className="h-5 w-auto" fill="currentColor">
        <text x="0" y="16" fontSize="16" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="-0.2">figma</text>
      </svg>
    ),
  },
];

/* ─── Magnetic Card ─────────────────────────────────────── */
function MagneticCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 22 });
  const springY = useSpring(y, { stiffness: 100, damping: 22 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-5, 5]);

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`perspective-2000 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── Team Card ──────────────────────────────────────────── */
function TeamCard({ member }: { member: typeof teamMembers[0] }) {
  return (
    <div className="premium-card p-6 flex flex-col justify-between h-full group hover:border-indigo-500/35 transition-all">
      <div>
        <div className="relative overflow-hidden rounded-xl mb-5 aspect-[4/3] bg-slate-950">
          <div className={`absolute inset-0 bg-gradient-to-br ${member.gradient} opacity-20`} />
          <img 
            src={member.image} 
            alt={member.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        <h3 className="font-bold text-lg text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{member.name}</h3>
        <p className="text-sm text-indigo-400 font-medium mt-0.5">{member.role}</p>
        <p className="text-xs text-gray-500 mt-1">{member.experience} experience</p>
        <p className="text-sm text-gray-400 leading-relaxed mt-4 mb-4">{member.bio}</p>
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {member.skills.map((s) => (
            <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/12 text-indigo-300 border border-indigo-500/18">{s}</span>
          ))}
        </div>
        <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/25 hover:bg-indigo-500/20 transition-colors">
          <Mail className="h-4 w-4" /> Contact Founder
        </button>
      </div>
    </div>
  );
}

/* ─── Carousel ──────────────────────────────────────────── */
function Carousel() {
  const [current, setCurrent] = useState(0);
  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), []);
  useEffect(() => { const t = setInterval(next, 5500); return () => clearInterval(t); }, [next]);
  const getIndex = (offset: number) => (current + offset + slides.length) % slides.length;

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-center gap-4 h-[340px] overflow-hidden">
        {[-1, 0, 1].map((offset) => {
          const idx = getIndex(offset);
          const slide = slides[idx];
          const isActive = offset === 0;
          return (
            <motion.div
              key={`${idx}-${offset}`}
              className={`relative rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer ring-1 ${isActive ? "ring-indigo-500/30" : "ring-white/5"}`}
              style={{ width: isActive ? "58%" : "22%", height: isActive ? "320px" : "210px" }}
              animate={{ opacity: isActive ? 1 : 0.4, filter: isActive ? "blur(0px)" : "blur(2px)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setCurrent(idx)}
            >
              <img src={slide.image} alt={slide.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <div className={`absolute inset-0 bg-gradient-to-t ${slide.gradient} opacity-60`} />
              <div className="absolute inset-0 bg-black/20" />
              <div className="relative h-full flex flex-col justify-end p-6">
                <h3 className="font-bold text-2xl text-white drop-shadow-lg" style={{ fontFamily: 'Syne, sans-serif' }}>{slide.title}</h3>
                {isActive && (
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-white/80 mt-1.5 text-sm leading-relaxed">
                    {slide.description}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <motion.button onClick={prev} className="h-9 w-9 rounded-full glass-card flex items-center justify-center" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <ChevronLeft className="h-4 w-4 text-gray-300" />
        </motion.button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-400 ${i === current ? "w-8 bg-indigo-400" : "w-2 bg-gray-700 hover:bg-gray-500"}`}
            />
          ))}
        </div>
        <motion.button onClick={next} className="h-9 w-9 rounded-full glass-card flex items-center justify-center" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Counter ───────────────────────────────────────────── */
function Counter({ target, label, suffix = "" }: { target: number; label: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [inView, target]);
  return (
    <div ref={ref} className="text-center">
      <div className="text-gradient font-bold text-4xl md:text-5xl" style={{ fontFamily: 'Syne, sans-serif' }}>
        {display.toLocaleString()}{suffix}
      </div>
      <div className="text-xs text-gray-500 mt-2 tracking-widest uppercase font-medium">{label}</div>
    </div>
  );
}

/* ─── Feature Card ──────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color, glow, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <MagneticCard>
        <div className="premium-card premium-card-interactive p-7 h-full group">
          <motion.div
            className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}
            style={{ boxShadow: `0 8px 24px ${glow}` }}
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.1 }}
            transition={{ duration: 0.4 }}
          >
            <Icon className="h-6 w-6 text-white" />
          </motion.div>
          <h3 className="font-bold text-base mb-2.5 text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
        </div>
      </MagneticCard>
    </motion.div>
  );
}

/* ─── Step Card ─────────────────────────────────────────── */
function StepCard({ icon: Icon, title, desc, color, num, index }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="premium-card p-8 text-center h-full group hover:border-indigo-500/35 transition-all relative">
        <div className="relative mx-auto mb-6 inline-block">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-xl group-hover:scale-110 group-hover:shadow-2xl transition-all duration-300`}>
            <Icon className="h-8 w-8 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white border-2 border-[#020817]">
            {num}
          </div>
        </div>
        <h3 className="font-bold text-lg mb-3 text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Trusted Companies Marquee ─────────────────────────── */
function TrustedCompanies() {
  const doubled = [...companies, ...companies];
  return (
    <section className="py-20 border-y border-indigo-500/10 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent, rgba(99,102,241,0.025), transparent)" }} />

      <div className="container mx-auto px-6 mb-10 text-center relative z-10">
        <p className="overline mb-2">Trusted by teams at</p>
        <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          World-Class Companies Trust <span className="text-gradient">JobAI Scout</span>
        </h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          From Fortune 500 enterprises to high-growth startups — our platform powers hiring at scale.
        </p>
      </div>

      {/* Row 1 — forward */}
      <div className="marquee-wrapper mb-4">
        <div className="marquee-track">
          {doubled.map((company, i) => (
            <motion.div
              key={`row1-${i}`}
              className="logo-card"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-white">{company.logo}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Row 2 — reverse (different companies) */}
      <div className="marquee-wrapper">
        <div className="marquee-track-reverse">
          {[...doubled].reverse().map((company, i) => (
            <motion.div
              key={`row2-${i}`}
              className="logo-card"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-white">{company.logo}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Trust indicators */}
      <div className="container mx-auto px-6 mt-10 relative z-10">
        <div className="flex flex-row flex-nowrap items-center justify-start md:justify-center gap-4 overflow-x-auto pb-3 scrollbar-none max-w-full">
          {[
            { icon: Shield, text: "SOC 2 Type II Certified" },
            { icon: Users, text: "500+ Companies Onboarded" },
            { icon: TrendingUp, text: "98% Client Satisfaction" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-full glass-card-sm text-sm text-gray-400 flex-shrink-0">
              <Icon className="h-4 w-4 text-indigo-400" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function Index() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(window.scrollY / total);
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navScrolled = scrollY > 50;

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden page-enter">

      {/* Scroll Progress */}
      <div className="scroll-progress-bar" style={{ transform: `scaleX(${scrollProgress})` }} />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <motion.nav
        className={`sticky top-0 z-50 transition-all duration-500 ${navScrolled ? "nav-premium shadow-xl shadow-black/40" : "bg-transparent"}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto px-6 flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              JobAI <span className="text-gradient">Scout</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[{ to: "/about", label: "About" }, { to: "/contact", label: "Contact" }].map(({ to, label }) => (
              <Link key={to} to={to} className="nav-link-premium">{label}</Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all font-medium">
              Sign in
            </Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register" className="btn-premium text-sm">
                Start free <ArrowRight className="inline h-3.5 w-3.5 ml-1" />
              </Link>
            </motion.div>
          </div>

          <button className="md:hidden p-2 rounded-lg glass-card-sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <div className={`w-5 h-0.5 bg-gray-300 mb-1.5 transition-all duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <div className={`w-5 h-0.5 bg-gray-300 mb-1.5 transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : ""}`} />
            <div className={`w-5 h-0.5 bg-gray-300 transition-all duration-300 ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden nav-premium border-t border-indigo-500/10 overflow-hidden"
            >
              <div className="container px-6 py-4 flex flex-col gap-3">
                <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white py-2 text-sm">About</Link>
                <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white py-2 text-sm">Contact</Link>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white py-2 text-sm">Sign in</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-premium text-center text-sm mt-1">Start free</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative w-full min-h-screen overflow-hidden flex items-center">
        <Suspense fallback={null}>
          <InteractiveHero3D />
        </Suspense>

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020817]/80 pointer-events-none z-5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,8,23,0.65)_0%,transparent_75%)] pointer-events-none z-5" />

        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.div
            className="container mx-auto px-6 text-center max-w-5xl"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <span className="badge-premium">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Intelligent Recruitment Platform — Now in Open Beta
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="display-xl text-white mb-6 leading-[0.92]">
              Stop Searching.<br />
              <span className="text-gradient">Start Getting Found.</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
              Upload your CV once. Our AI extracts your skills, matches you to the right roles,
              and helps you apply — all in under 60 seconds.
            </motion.p>

            <motion.p variants={fadeUp} custom={3} className="text-sm text-gray-600 max-w-lg mx-auto mb-10">
              For recruiters: post jobs, get AI-ranked candidates, and close positions faster than ever.
            </motion.p>

            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to="/register" className="btn-premium text-base inline-flex items-center gap-2.5 px-7 py-3.5">
                  <Upload className="h-4 w-4" />
                  Upload Your CV — It's Free
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/login" className="btn-outline-premium text-base inline-flex items-center gap-2 px-7 py-3.5">
                  Sign in to Dashboard
                </Link>
              </motion.div>
            </motion.div>

            {/* Social proof */}
            <motion.div variants={fadeUp} custom={5} className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
              <Counter target={10000} label="Job Seekers" suffix="+" />
              <div className="h-10 w-px bg-indigo-500/20 hidden md:block" />
              <Counter target={94} label="Match Accuracy" suffix="%" />
              <div className="h-10 w-px bg-indigo-500/20 hidden md:block" />
              <Counter target={50000} label="Jobs Indexed" suffix="+" />
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          <span className="text-xs text-gray-600 tracking-widest uppercase">Discover more</span>
          <ArrowDown className="h-4 w-4 text-gray-600" />
        </motion.div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-25 pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">How It Works</span>
            <h2 className="heading-lg text-white">From CV to Offer in 3 Steps</h2>
            <p className="body-lg text-gray-500 mt-3 max-w-lg mx-auto">
              The fastest path from job seeker to candidate. Powered entirely by AI.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 relative">
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent" />
            <StepCard index={0} num="1" icon={FileText} title="Drop Your CV" desc="Upload any PDF or DOCX — our AI reads it in seconds, extracting every skill, role, and experience with precision." color="from-blue-500 to-indigo-600" />
            <StepCard index={1} num="2" icon={Cpu} title="AI Builds Your Profile" desc="Watch your skills, desired roles, location, and experience level populate automatically — no typing required." color="from-emerald-500 to-teal-600" />
            <StepCard index={2} num="3" icon={MousePointerClick} title="Apply in One Click" desc="Browse ranked matches, generate personalised cover letters, and submit applications in seconds, not hours." color="from-amber-500 to-orange-600" />
          </div>
        </div>
      </section>

      {/* ── Why Choose Us + 3D DNA ────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 z-0 h-full">
          <Suspense fallback={null}>
            <FloatingObjects3D backgroundColor="#060d24" />
          </Suspense>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#020817]/85 via-transparent to-[#020817]/85 pointer-events-none z-1" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">Platform Advantages</span>
            <h2 className="heading-lg text-white">Built Different, By Design</h2>
            <p className="body-lg text-gray-500 mt-3 max-w-xl mx-auto">
              Every feature was engineered to give candidates an unfair advantage and give recruiters back their time.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Intelligent Matching Split ────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <Suspense fallback={null}>
            <ParticleSystem3D particleCount={350} />
          </Suspense>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <span className="overline block mb-4">AI Intelligence</span>
              <h2 className="heading-lg text-white mb-6">
                Matches That Actually<br />
                <span className="text-gradient">Make Sense</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Unlike keyword-matching job boards, our AI understands the{" "}
                <em className="text-gray-300 not-italic font-medium">meaning</em> behind your experience. It reads between the lines — surfacing opportunities even you didn't know existed.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Semantic skill extraction — not just keywords",
                  "Career trajectory analysis and progression scoring",
                  "Real-time salary benchmarking by location",
                  "Interview prep personalised to each role",
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    className="flex items-start gap-3 text-gray-300 text-sm"
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ x: 5 }}
                  >
                    <CheckCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to="/register" className="btn-premium inline-flex items-center gap-2">
                  Try AI Matching Free <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>

            {/* Right — Live Match Preview */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="premium-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    AI Match Results
                  </h3>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
                {[
                  { title: "Principal Engineer, AI Platform", company: "DeepMind • London, Remote", match: 97, color: "from-indigo-500 to-violet-500", salary: "£120–145k" },
                  { title: "Senior Full-Stack Engineer", company: "Stripe • Dublin, Hybrid", match: 94, color: "from-cyan-500 to-blue-500", salary: "€95–115k" },
                  { title: "Lead React Developer", company: "Monzo • Remote-first", match: 91, color: "from-emerald-500 to-teal-500", salary: "£80–100k" },
                  { title: "Frontend Engineer — Growth", company: "Notion • San Francisco", match: 87, color: "from-violet-500 to-purple-500", salary: "$130–160k" },
                ].map((job, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between p-3.5 glass-card-sm rounded-xl mb-2.5 hover:border-indigo-500/25 transition-all cursor-pointer group"
                    whileHover={{ scale: 1.01, x: 3 }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${job.color} flex items-center justify-center flex-shrink-0`}>
                        <Briefcase className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm leading-snug">{job.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{job.company}</p>
                        <p className="text-xs text-indigo-400 mt-0.5">{job.salary}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-bold text-cyan-400 text-sm">{job.match}%</p>
                      <p className="text-xs text-gray-700">match</p>
                    </div>
                  </motion.div>
                ))}
                <Link to="/register" className="flex items-center justify-center gap-2 mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium py-2">
                  Unlock your personalised matches →
                </Link>
              </div>
              <div className="absolute -inset-6 bg-indigo-500/4 rounded-3xl blur-3xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden bg-[#060d24]/40">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">Our People</span>
            <h2 className="heading-lg text-white">The Team Behind the Magic</h2>
            <p className="body-lg text-gray-500 mt-3 max-w-lg mx-auto">
              A small, mighty team obsessed with making job searching not suck.
              <br /><span className="text-gray-600 text-sm">Hover any card to learn more.</span>
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <TeamCard member={member} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Features Carousel ───────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="flex justify-center mb-10">
          <div className="relative w-full">
            <Suspense fallback={null}>
              <ScrollTransition3D progress={scrollProgress} />
            </Suspense>
          </div>
        </div>

        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">Platform Features</span>
            <h2 className="heading-lg text-white">Everything You Need to Win</h2>
            <p className="body-lg text-gray-500 mt-3">
              One platform, every tool — from first upload to final offer.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <Carousel />
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden bg-[#060d24]/40">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">Social Proof</span>
            <h2 className="heading-lg text-white">Real People. Real Results.</h2>
            <p className="body-lg text-gray-500 mt-3 max-w-md mx-auto">
              Join thousands of professionals who've already transformed their job search.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <MagneticCard>
                  <div className="premium-card p-7 h-full flex flex-col group">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-5">"{t.text}"</p>
                    {/* Metric badge */}
                    <div className="mb-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
                        <TrendingUp className="h-3 w-3" />
                        {t.metric}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                      <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full ring-2 ring-indigo-500/25" />
                      <div>
                        <p className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{t.name}</p>
                        <p className="text-xs text-gray-500">{t.role} · {t.company}</p>
                      </div>
                    </div>
                  </div>
                </MagneticCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────── */}
      <section className="py-16 border-y border-indigo-500/10">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-sm text-gray-400">
            {[
              { icon: Check, text: "10,000+ job seekers placed" },
              { icon: TrendingUp, text: "94% AI match accuracy" },
              { icon: Shield, text: "SOC 2 Type II certified" },
              { icon: Zap, text: "Sub-second response time" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Icon className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-28">
        <div className="container mx-auto px-6">
          <motion.div
            className="relative rounded-3xl overflow-hidden p-14 lg:p-24 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 gradient-hero opacity-90" />
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute inset-0 dot-bg opacity-15" />
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-white/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-white/8 rounded-full blur-3xl" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <motion.span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white text-sm font-medium mb-8 border border-white/20"
                whileHover={{ scale: 1.05 }}
              >
                <Rocket className="h-4 w-4" />
                Join 10,000+ professionals already inside
              </motion.span>

              <h2 className="display-lg text-white mb-6 leading-tight">
                Your next career chapter<br />starts right now
              </h2>

              <p className="text-white/75 text-lg mb-10 leading-relaxed">
                Free to start. No CV left unmatched. The smartest job platform ever built — finally open to everyone.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/register" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-indigo-700 font-bold text-base hover:shadow-2xl hover:shadow-white/20 transition-all">
                    <Upload className="h-5 w-5" />
                    Get Started — It's Free
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/about" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/12 text-white font-semibold text-base hover:bg-white/22 transition-all border border-white/18">
                    Learn More
                  </Link>
                </motion.div>
              </div>

              <p className="text-white/40 text-xs mt-8">
                No credit card required · Cancel anytime · GDPR compliant
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="footer-premium pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid gap-10 md:grid-cols-4 mb-12">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>JobAI Scout</span>
              </Link>
              <p className="text-gray-600 text-sm leading-relaxed max-w-xs mb-5">
                AI-Powered Intelligent Job Application Platform. Built with passion at IIU Islamabad, Pakistan.
              </p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-gray-600">All systems operational</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Product</h4>
              <ul className="space-y-3">
                {[{ to: "/about", label: "About Us" }, { to: "/contact", label: "Contact" }, { to: "/privacy", label: "Privacy Policy" }, { to: "/register", label: "Get Started" }].map(({ to, label }) => (
                  <li key={to}><Link to={to} className="text-gray-600 hover:text-indigo-400 text-sm transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Platform</h4>
              <ul className="space-y-3">
                {[{ to: "/register", label: "For Job Seekers" }, { to: "/register", label: "For Recruiters" }, { to: "/login", label: "Sign In" }].map(({ to, label }) => (
                  <li key={label}><Link to={to} className="text-gray-600 hover:text-indigo-400 text-sm transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="section-divider" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-xs text-gray-700">
            <p>© 2026 JobAI Scout — All rights reserved.</p>
            <p>Made with ♥ by Abdullah Waheed & Arsalan Haider · IIU Islamabad</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
