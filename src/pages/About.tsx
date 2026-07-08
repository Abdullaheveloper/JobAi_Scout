import { Link } from "react-router-dom";
import { Briefcase, Users, Target, Award, ArrowLeft, Globe, Zap, Shield, CheckCircle, ArrowRight, Rocket, Heart, Code2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const teamMembers = [
  {
    name: "Abdullah Waheed",
    role: "Co-Founder & Lead Developer",
    bio: "Full-stack engineer passionate about AI-driven recruitment solutions.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abdullah",
    skills: ["React", "Node.js", "AI/ML", "Supabase"],
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    name: "Arsalan Haider",
    role: "Co-Founder & Product Lead",
    bio: "Product strategist focused on building scalable hiring platforms.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arsalan",
    skills: ["Figma", "Product", "UX Research", "Strategy"],
    gradient: "from-violet-500 to-pink-600",
  },
];

const stats = [
  { label: "Active Users", value: "10,000+", icon: Users, color: "from-indigo-500 to-violet-600" },
  { label: "Jobs Matched", value: "50,000+", icon: Briefcase, color: "from-cyan-500 to-blue-600" },
  { label: "Companies Trust Us", value: "500+", icon: Globe, color: "from-emerald-500 to-teal-600" },
  { label: "Success Rate", value: "94%", icon: Target, color: "from-rose-500 to-orange-600" },
];

const timeline = [
  { year: "2024", title: "The Idea", desc: "Two IIU students frustrated with outdated job portals decided to build something smarter.", icon: Heart },
  { year: "2024", title: "First Prototype", desc: "Built a working AI CV parser that extracted skills with 90%+ accuracy in just 4 weeks.", icon: Code2 },
  { year: "2025", title: "Beta Launch", desc: "Launched to 500 early users, received overwhelming positive feedback on AI matching.", icon: Rocket },
  { year: "2026", title: "Scale & Growth", desc: "10,000+ active users, 50,000+ jobs indexed, and partnerships with leading companies.", icon: Award },
];

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

function AnimatedStat({ value, label, icon: Icon, color }: any) {
  const [display, setDisplay] = useState("0");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const num = parseInt(value.replace(/[^0-9]/g, ""));
    const suffix = value.replace(/[0-9]/g, "");
    const duration = 1600;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(num * eased).toLocaleString() + suffix);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      className="premium-card p-6 text-center group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
    >
      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="text-gradient font-bold text-3xl" style={{ fontFamily: 'Syne, sans-serif' }}>{display}</div>
      <div className="text-sm text-gray-500 mt-1.5">{label}</div>
    </motion.div>
  );
}

export default function About() {
  useEffect(() => {
    // Preload other main routes when the browser is idle to speed up navigation
    const preloadRoutes = () => {
      import("./Index").catch(() => {});
      import("./Contact").catch(() => {});
      import("./Login").catch(() => {});
      import("./Register").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(preloadRoutes);
    } else {
      setTimeout(preloadRoutes, 2000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden page-enter">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 nav-premium">
        <div className="container mx-auto px-6 flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              JobAI <span className="text-gradient">Scout</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="nav-link-premium">Contact</Link>
            <Link to="/register" className="btn-premium text-sm">Get Started <ArrowRight className="inline h-4 w-4 ml-1" /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-20 pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-400 transition-colors mb-8">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
            <span className="badge-premium mb-6 inline-flex">
              <Award className="h-3.5 w-3.5" /> Our Story
            </span>
          </motion.div>

          <motion.h1
            className="heading-xl text-white mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            Building the Future of{" "}
            <span className="text-gradient">AI Recruitment</span>
          </motion.h1>

          <motion.p
            className="body-lg text-gray-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            JobAI Scout was founded at IIU Islamabad with a mission to bridge the gap between talent
            and opportunity using cutting-edge artificial intelligence and modern recruitment practices.
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 relative">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {stats.map((stat) => (
              <AnimatedStat key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* Mission / Vision / Values */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">What Drives Us</span>
            <h2 className="heading-lg text-white">Our Foundation</h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Target,
                title: "Our Mission",
                desc: "Democratize job searching by making AI-powered matching accessible to every job seeker and recruiter worldwide.",
                color: "from-indigo-500 to-violet-600",
                glow: "rgba(99,102,241,0.2)",
              },
              {
                icon: Globe,
                title: "Our Vision",
                desc: "A world where finding the right job — or the right candidate — takes minutes, not months, powered by intelligence.",
                color: "from-cyan-500 to-blue-600",
                glow: "rgba(6,182,212,0.2)",
              },
              {
                icon: Shield,
                title: "Our Values",
                desc: "Transparency, data privacy, and fairness in AI. We build ethical technology that serves everyone equally.",
                color: "from-emerald-500 to-teal-600",
                glow: "rgba(16,185,129,0.2)",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="premium-card p-8 text-center group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -6 }}
              >
                <div
                  className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-xl group-hover:scale-110 transition-transform`}
                  style={{ boxShadow: `0 8px 24px ${item.glow}` }}
                >
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-xl text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 relative overflow-hidden bg-[#060d24]/40">
        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">Our Journey</span>
            <h2 className="heading-lg text-white">From Idea to Impact</h2>
          </motion.div>

          <div className="relative max-w-3xl mx-auto">
            {/* Vertical line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent" />

            {timeline.map((item, i) => {
              const isRight = i % 2 === 0;
              return (
                <motion.div
                  key={item.title}
                  className={`relative flex items-start gap-6 mb-12 ${isRight ? "md:flex-row" : "md:flex-row-reverse"} flex-row`}
                  initial={{ opacity: 0, x: isRight ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  {/* Dot */}
                  <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full gradient-primary shadow-lg shadow-indigo-500/30 z-10 flex-shrink-0">
                    <item.icon className="h-4 w-4 text-white" />
                  </div>

                  {/* Card */}
                  <div className={`ml-20 md:ml-0 ${isRight ? "md:mr-8 md:text-right md:w-5/12" : "md:ml-8 md:text-left md:w-5/12 md:ml-auto"} w-full`}>
                    <div className="glass-card p-5">
                      <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">{item.year}</span>
                      <h3 className="font-bold text-white mt-1 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{item.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-20 border-y border-indigo-500/10 overflow-hidden relative">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent, rgba(99,102,241,0.025), transparent)" }} />
        <div className="container mx-auto px-6 text-center mb-10 relative z-10">
          <p className="overline mb-2">Trusted Partners</p>
          <h2 className="heading-md text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Trusted by Leading <span className="text-gradient">Companies</span>
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Our founders and advisors have built solutions trusted across the global technology ecosystem.
          </p>
        </div>

        {/* Row 1 — forward */}
        <div className="marquee-wrapper mb-4">
          <div className="marquee-track">
            {[...companies, ...companies].map((company, i) => (
              <motion.div
                key={`about-row1-${i}`}
                className="logo-card"
                whileHover={{ scale: 1.05 }}
              >
                <div className="text-white">{company.logo}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Row 2 — reverse */}
        <div className="marquee-wrapper">
          <div className="marquee-track-reverse">
            {[...companies, ...companies].reverse().map((company, i) => (
              <motion.div
                key={`about-row2-${i}`}
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

      {/* Team */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="overline block mb-3">The Founders</span>
            <h2 className="heading-lg text-white">Meet the Team</h2>
            <p className="body-lg text-gray-500 mt-3">The minds behind JobAI Scout</p>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2 max-w-2xl mx-auto">
            {teamMembers.map((member, i) => (
              <motion.div
                key={member.name}
                className="premium-card p-6 flex flex-col justify-between h-full group hover:border-indigo-500/35 transition-all"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
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
                  <p className="text-sm text-gray-400 leading-relaxed mt-4 mb-4">{member.bio}</p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {member.skills.map((skill) => (
                      <span key={skill} className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/12 text-indigo-300 border border-indigo-500/18">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/25 hover:bg-indigo-500/20 transition-colors">
                    <Mail className="h-4 w-4" /> Contact Founder
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <motion.div
            className="relative rounded-3xl overflow-hidden p-14 lg:p-20 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 gradient-hero opacity-85" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 dot-bg opacity-15" />
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/8 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="display-md text-white mb-5">Ready to Transform Your Hiring?</h2>
              <p className="text-white/80 max-w-lg mx-auto mb-10 text-lg">
                Join thousands of job seekers and recruiters already using JobAI Scout.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-indigo-700 font-bold text-base hover:shadow-xl hover:shadow-white/20 transition-all">
                  Create Free Account <ArrowRight className="h-5 w-5" />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/15 text-white font-semibold text-base hover:bg-white/25 transition-all border border-white/20">
                  Contact Us
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-premium py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <p>© 2026 JobAI Scout — AI-Powered Intelligent Job Application Platform</p>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-indigo-400 transition-colors">About</Link>
            <Link to="/contact" className="hover:text-indigo-400 transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
