import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  FileUp, Briefcase, Bookmark, Sparkles, TrendingUp, Target, ArrowRight,
  Zap, Mic, Brain, BarChart3, CheckCircle2, Clock, Star
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

/* ─── Animated Counter ────────────────────────────────── */
function AnimatedCount({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || value === 0) { setDisplay(value); return; }
    const duration = 1200;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [inView, value]);

  return <span ref={ref}>{display}{suffix}</span>;
}

/* ─── Metric Card ─────────────────────────────────────── */
function MetricCard({
  icon: Icon, title, value, suffix = "", sub, gradient, delay, link
}: {
  icon: any; title: string; value: number; suffix?: string; sub: string;
  gradient: string; delay: number; link?: string;
}) {
  const content = (
    <motion.div
      className="metric-card group relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
    >
      {/* Gradient background glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {link && (
          <ArrowRight className="h-4 w-4 text-gray-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
        )}
      </div>

      <div className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
        <AnimatedCount value={value} suffix={suffix} />
      </div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-xs text-gray-700 mt-1">{sub}</p>
    </motion.div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

/* ─── Quick Action Card ───────────────────────────────── */
function QuickAction({ icon: Icon, title, desc, to, gradient, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Link to={to}>
        <motion.div
          className="glass-card-sm rounded-xl p-4 flex items-center gap-4 cursor-pointer group border border-white/6 hover:border-indigo-500/25 transition-all"
          whileHover={{ y: -2, x: 2 }}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md flex-shrink-0 group-hover:scale-110 transition-transform`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</p>
            <p className="text-xs text-gray-600 truncate">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const skills = profile?.skills || [];
  const desiredRoles = profile?.desired_roles || [];
  const hasProfile = skills.length > 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const quickActions = [
    { icon: FileUp, title: "Upload Your CV", desc: "Let AI parse your skills instantly", to: "/dashboard/cv", gradient: "from-indigo-500 to-violet-600", delay: 0.3 },
    { icon: Briefcase, title: "Browse Jobs", desc: "Explore AI-matched opportunities", to: "/dashboard/jobs", gradient: "from-cyan-500 to-blue-600", delay: 0.35 },
    { icon: Bookmark, title: "Saved Jobs", desc: "Review your bookmarked positions", to: "/dashboard/saved", gradient: "from-emerald-500 to-teal-600", delay: 0.4 },
    { icon: Mic, title: "Voice Assistant", desc: "Get career guidance hands-free", to: "/dashboard/assistant", gradient: "from-violet-500 to-purple-600", delay: 0.45 },
    { icon: Zap, title: "Auto Form Fill", desc: "Apply to jobs in one click", to: "/dashboard/auto-fill", gradient: "from-amber-500 to-orange-600", delay: 0.5 },
    { icon: BarChart3, title: "Analytics", desc: "Track your application progress", to: "/dashboard/analytics", gradient: "from-rose-500 to-pink-600", delay: 0.55 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl">
        {/* Welcome Header */}
        <motion.div
          className="relative rounded-2xl overflow-hidden p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 50%, rgba(6,182,212,0.08) 100%)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-gray-500 mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {greeting} 👋
              </p>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {profile?.full_name || "Welcome back!"}
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                {hasProfile
                  ? `You have ${skills.length} skills and ${desiredRoles.length} suggested roles. Ready to find your next opportunity?`
                  : "Upload your CV to unlock AI-powered job matching and career insights."}
              </p>
            </div>

            {!hasProfile && (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/dashboard/cv"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all"
                >
                  <FileUp className="h-4 w-4" />
                  Upload CV Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            )}
          </div>

          {hasProfile && (
            <div className="relative z-10 flex items-center gap-2 mt-5 flex-wrap">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Profile Active</span>
              <span className="text-xs text-gray-600">·</span>
              <Star className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-gray-400">{skills.length} skills extracted</span>
              <span className="text-xs text-gray-600">·</span>
              <Target className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs text-gray-400">{desiredRoles.length} roles suggested</span>
            </div>
          )}
        </motion.div>

        {/* Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Sparkles} title="Skills Detected" value={skills.length} sub="from CV analysis"
            gradient="from-indigo-500 to-violet-600" delay={0.1} link="/dashboard/cv"
          />
          <MetricCard
            icon={Target} title="Suggested Roles" value={desiredRoles.length} sub="AI-recommended positions"
            gradient="from-violet-500 to-purple-600" delay={0.15} link="/dashboard/jobs"
          />
          <MetricCard
            icon={TrendingUp} title="Profile Score" value={hasProfile ? 85 : 20} suffix="%" sub={hasProfile ? "Ready for matching" : "Upload CV to improve"}
            gradient="from-cyan-500 to-blue-600" delay={0.2}
          />
          <MetricCard
            icon={Brain} title="AI Matches" value={hasProfile ? 24 : 0} sub="jobs matching your profile"
            gradient="from-emerald-500 to-teal-600" delay={0.25} link="/dashboard/jobs"
          />
        </div>

        {/* Skills & Roles (when profile exists) */}
        {hasProfile && (
          <div className="grid gap-5 md:grid-cols-2">
            <motion.div
              className="metric-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Your Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.slice(0, 12).map((skill: string) => (
                  <span key={skill} className="px-2.5 py-1 text-xs rounded-lg bg-indigo-500/12 text-indigo-300 border border-indigo-500/20 font-medium">
                    {skill}
                  </span>
                ))}
                {skills.length > 12 && (
                  <span className="px-2.5 py-1 text-xs rounded-lg bg-white/5 text-gray-500 border border-white/8">
                    +{skills.length - 12} more
                  </span>
                )}
              </div>
            </motion.div>

            <motion.div
              className="metric-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Suggested Roles</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {desiredRoles.map((role: string) => (
                  <span key={role} className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/12 text-violet-300 border border-violet-500/20 font-medium">
                    {role}
                  </span>
                ))}
              </div>
              <Link
                to="/dashboard/jobs"
                className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Browse Matching Jobs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <motion.div
            className="flex items-center gap-2 mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Clock className="h-4 w-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Quick Actions
            </h2>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <QuickAction key={action.title} {...action} />
            ))}
          </div>
        </div>

        {/* Upload CTA (when no profile) */}
        {!hasProfile && (
          <motion.div
            className="relative rounded-2xl overflow-hidden p-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
              border: "2px dashed rgba(99,102,241,0.25)",
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/30 mx-auto mb-5">
              <FileUp className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
              Upload Your CV to Get Started
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Our AI will instantly parse your resume, extract skills, suggest ideal job roles,
              and find matching opportunities — all in under 30 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/dashboard/cv"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30"
                >
                  <FileUp className="h-4 w-4" />
                  Upload CV Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
