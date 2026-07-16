import { Link } from "react-router-dom";
import { Briefcase, Users, Target, Award, ArrowLeft, Globe, Shield, ArrowRight, Rocket, Heart, Code2, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const teamMembers = [
  {
    name: "Abdullah Waheed",
    role: "Co-Founder & Lead Developer",
    bio: "Full-stack engineer passionate about AI-driven recruitment solutions.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abdullah",
    skills: ["React", "Node.js", "AI/ML", "Supabase"],
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    name: "Arsalan Haider",
    role: "Co-Founder & Product Lead",
    bio: "Product strategist focused on building scalable hiring platforms.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arsalan",
    skills: ["Figma", "Product", "UX Research", "Strategy"],
    gradient: "from-teal-500 to-mint-600",
  },
];

const stats = [
  { label: "Active Users", value: "10,000+", icon: Users, color: "from-emerald-500 to-teal-600" },
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
    <div className="min-h-screen bg-[#020a08] text-white overflow-x-hidden page-enter">
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
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 font-medium hover:text-emerald-400 transition-colors mb-8">
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
                color: "from-emerald-500 to-teal-600",
                glow: "rgba(16,185,129,0.2)",
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
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent" />

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
                  <div className="absolute left-8 md:left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full gradient-primary shadow-lg shadow-emerald-500/30 z-10 flex-shrink-0">
                    <item.icon className="h-4 w-4 text-white" />
                  </div>

                  {/* Card */}
                  <div className={`ml-20 md:ml-0 ${isRight ? "md:mr-8 md:text-right md:w-5/12" : "md:ml-8 md:text-left md:w-5/12 md:ml-auto"} w-full`}>
                    <div className="glass-card p-5">
                      <span className="text-xs text-emerald-400 font-bold tracking-wider uppercase">{item.year}</span>
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
                className="premium-card p-6 flex flex-col justify-between h-full group hover:border-emerald-500/35 transition-all"
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
                  <p className="text-sm text-emerald-400 font-medium mt-0.5">{member.role}</p>
                  <p className="text-sm text-gray-300 font-medium leading-relaxed mt-4 mb-4">{member.bio}</p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {member.skills.map((skill) => (
                      <span key={skill} className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/12 text-emerald-300 border border-emerald-500/18">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 font-bold text-sm border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors">
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
                <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-emerald-700 font-bold text-base hover:shadow-xl hover:shadow-white/20 transition-all">
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
            <Link to="/about" className="hover:text-emerald-400 font-semibold transition-colors">About</Link>
            <Link to="/contact" className="hover:text-emerald-400 font-semibold transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-emerald-400 font-semibold transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
