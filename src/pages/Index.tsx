import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Sparkles, ArrowRight, Upload, Target, Zap, CheckCircle, ChevronLeft, ChevronRight, Mail, Shield, Brain, Globe, Rocket, Users, BarChart3 } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";

import slideAiResume from "@/assets/slide-ai-resume.jpg";
import slideJobMatching from "@/assets/slide-job-matching.jpg";
import slideRecruiterCrm from "@/assets/slide-recruiter-crm.jpg";
import slideOneClick from "@/assets/slide-one-click.jpg";
import slideVoiceAssistant from "@/assets/slide-voice-assistant.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const teamMembers = [
  {
    name: "Abdullah Waheed",
    role: "Full-Stack Developer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abdullah",
    experience: "5+ years",
    skills: ["React", "Node.js", "AI/ML", "Supabase"],
    bio: "Building intelligent job platforms with cutting-edge AI technology.",
  },
  {
    name: "Arsalan Haider",
    role: "UI/UX Designer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arsalan",
    experience: "4+ years",
    skills: ["Figma", "Tailwind", "Framer Motion", "Design Systems"],
    bio: "Crafting beautiful, accessible interfaces that delight users.",
  },
  {
    name: "Sarah Khan",
    role: "AI Engineer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    experience: "6+ years",
    skills: ["Python", "NLP", "TensorFlow", "CV Parsing"],
    bio: "Pioneering AI-driven recruitment and skill-matching algorithms.",
  },
  {
    name: "Ahmed Raza",
    role: "Backend Architect",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed",
    experience: "7+ years",
    skills: ["PostgreSQL", "Deno", "APIs", "Security"],
    bio: "Scaling robust infrastructure for millions of job seekers.",
  },
];

const slides = [
  {
    title: "AI Resume Parser",
    description: "Instantly extract skills, experience, and education from any CV format.",
    gradient: "from-blue-600 to-indigo-700",
    image: slideAiResume,
  },
  {
    title: "Smart Job Matching",
    description: "94% accuracy matching candidates to their ideal positions using ML.",
    gradient: "from-violet-600 to-purple-700",
    image: slideJobMatching,
  },
  {
    title: "Recruiter CRM",
    description: "Full pipeline management with Kanban boards and real-time messaging.",
    gradient: "from-emerald-600 to-teal-700",
    image: slideRecruiterCrm,
  },
  {
    title: "One-Click Apply",
    description: "AI-generated cover letters with auto-fill for lightning-fast applications.",
    gradient: "from-orange-500 to-rose-600",
    image: slideOneClick,
  },
  {
    title: "Voice Assistant",
    description: "Hands-free career guidance powered by ElevenLabs conversational AI.",
    gradient: "from-pink-500 to-fuchsia-600",
    image: slideVoiceAssistant,
  },
];

// Magnetic hover card
function MagneticCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8]);

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
      className={`perspective-1000 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function FlipCard({ member }: { member: typeof teamMembers[0] }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="group perspective-1000 cursor-pointer"
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped(!flipped)}
    >
      <motion.div
        className="relative w-full h-[340px] preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="absolute inset-0 backface-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
          <div className="relative z-0 h-24 gradient-hero opacity-80" />
          <div className="relative z-10 flex flex-col items-center -mt-12 px-6 pb-6">
            <div className="relative z-10 h-24 w-24 rounded-full border-4 border-card bg-muted overflow-hidden shadow-lg">
              <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
            </div>
            <h3 className="font-display text-lg font-bold mt-3">{member.name}</h3>
            <p className="text-sm text-primary font-medium">{member.role}</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {member.skills.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 backface-hidden rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-lg rotate-y-180 p-6 flex flex-col justify-center items-center text-center">
          <Badge className="gradient-primary border-0 mb-3">{member.experience} Experience</Badge>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{member.bio}</p>
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {member.skills.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Contact
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Carousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next]);

  const getIndex = (offset: number) => (current + offset + slides.length) % slides.length;

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-center gap-4 h-[320px] overflow-hidden">
        {[-1, 0, 1].map((offset) => {
          const idx = getIndex(offset);
          const slide = slides[idx];
          const isActive = offset === 0;

          return (
            <motion.div
              key={`${idx}-${offset}`}
              className={`relative rounded-2xl overflow-hidden flex-shrink-0 ${
                isActive ? "w-[60%] h-[300px] z-10" : "w-[25%] h-[220px] z-0"
              }`}
              animate={{
                scale: isActive ? 1 : 0.85,
                opacity: isActive ? 1 : 0.5,
                filter: isActive ? "blur(0px)" : "blur(3px)",
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Background image */}
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                width={1280}
                height={720}
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${slide.gradient} opacity-60`} />
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative h-full flex flex-col justify-end p-6 text-white">
                <h3 className="font-display text-2xl font-bold drop-shadow-lg">{slide.title}</h3>
                {isActive && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/90 mt-2 text-sm drop-shadow-md"
                  >
                    {slide.description}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Morphing blob animation
function MorphBlob() {
  return (
    <motion.div
      className="absolute w-[600px] h-[600px] rounded-full opacity-20"
      style={{
        background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
        filter: "blur(80px)",
      }}
      animate={{
        borderRadius: [
          "30% 70% 70% 30% / 30% 30% 70% 70%",
          "70% 30% 30% 70% / 70% 70% 30% 30%",
          "50% 50% 70% 30% / 60% 40% 60% 40%",
          "30% 70% 70% 30% / 30% 30% 70% 70%",
        ],
        x: [0, 100, -50, 0],
        y: [0, -80, 60, 0],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// Text scramble effect for stats
function ScrambleNumber({ target, label }: { target: string; label: string }) {
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
    const num = parseInt(target.replace(/[^0-9]/g, ""));
    const suffix = target.replace(/[0-9]/g, "");
    const duration = 1500;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(num * eased).toLocaleString() + suffix);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [inView, target]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-3xl font-bold text-gradient">{display}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// Parallax tilt feature card
function FeatureCard({ icon: Icon, title, desc, color, index }: { icon: any; title: string; desc: string; color: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <MagneticCard>
        <Card className="text-center p-8 border-border/50 bg-card/60 backdrop-blur-xl hover:shadow-xl transition-all h-full group overflow-hidden relative">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
               style={{ background: `radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.08), transparent 60%)` }} />
          <CardContent className="p-0 relative">
            <motion.div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}
              whileHover={{ rotate: [0, -10, 10, -5, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <Icon className="h-7 w-7 text-white" />
            </motion.div>
            <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground">{desc}</p>
          </CardContent>
        </Card>
      </MagneticCard>
    </motion.div>
  );
}

// Floating particles
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/60 backdrop-blur-2xl">
        <div className="container flex h-16 items-center justify-between">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-lg">
              <Briefcase className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">JobAI</span>
          </motion.div>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button variant="ghost" asChild><Link to="/about">About</Link></Button>
            <Button variant="ghost" asChild><Link to="/contact">Contact</Link></Button>
            <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
            <Button asChild className="gradient-primary border-0 shadow-lg"><Link to="/register">Get Started</Link></Button>
          </motion.div>
        </div>
      </nav>

      <div className="overflow-x-hidden">
        {/* Hero */}
        <section className="relative overflow-hidden py-24 lg:py-36">
        <MorphBlob />
        <FloatingParticles />
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[100px]"
            animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div
          className="container relative text-center max-w-4xl"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp} custom={0}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm border border-border/50 bg-card/60 backdrop-blur-lg">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> AI-Powered Job Matching
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-5xl font-extrabold tracking-tight lg:text-7xl"
          >
            Find Your Perfect Job with{" "}
            <motion.span
              className="text-gradient inline-block"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 5, repeat: Infinity }}
              style={{ backgroundSize: "200% 200%" }}
            >
              AI Intelligence
            </motion.span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            For job seekers: upload your CV and get AI-matched opportunities.
            For recruiters: post jobs, track applicants, and manage your hiring pipeline.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="text-base px-8 gradient-primary border-0 shadow-lg hover:shadow-xl transition-shadow" asChild>
                <Link to="/register">Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" className="text-base px-8 bg-card/60 backdrop-blur-lg border-border/50" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={4}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto"
          >
            <ScrambleNumber target="10K+" label="Active Users" />
            <ScrambleNumber target="94%" label="Match Accuracy" />
            <ScrambleNumber target="50K+" label="Jobs Scraped" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features — magnetic tilt cards */}
      <section className="py-20 relative">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl font-bold lg:text-4xl">How It Works</h2>
            <p className="mt-3 text-lg text-muted-foreground">Three simple steps to your dream job</p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard index={0} icon={Upload} title="Upload Your CV" desc="Upload your resume in PDF or DOCX format. Our AI processes it instantly." color="from-blue-500 to-indigo-600" />
            <FeatureCard index={1} icon={Target} title="AI Skill Extraction" desc="Advanced AI extracts skills, experience, and suggests matching job roles." color="from-emerald-500 to-teal-600" />
            <FeatureCard index={2} icon={Zap} title="Smart Job Matching" desc="Get ranked job recommendations based on your unique skill profile." color="from-amber-500 to-orange-600" />
          </div>
        </div>
      </section>

      {/* Why Choose Us — new animated section */}
      <section className="py-20 relative overflow-hidden">
        <FloatingParticles />
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl font-bold lg:text-4xl">Why Choose JobAI</h2>
            <p className="mt-3 text-lg text-muted-foreground">Powered by cutting-edge technology</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Brain, title: "AI-First Architecture", desc: "Every feature is powered by machine learning for smarter results.", delay: 0 },
              { icon: Shield, title: "Enterprise Security", desc: "SOC 2 compliant with end-to-end encryption and RLS policies.", delay: 0.1 },
              { icon: Globe, title: "Location-Smart Scraping", desc: "Jobs scraped from your city using your CV-extracted location.", delay: 0.2 },
              { icon: Rocket, title: "Lightning Fast", desc: "Sub-second response times with edge functions worldwide.", delay: 0.3 },
              { icon: Users, title: "3-Role System", desc: "Tailored experiences for Job Seekers, Recruiters, and Admins.", delay: 0.4 },
              { icon: BarChart3, title: "Real-Time Analytics", desc: "Track applications, pipeline stages, and hiring metrics.", delay: 0.5 },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.8, rotateY: 30 }}
                whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ delay: item.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <MagneticCard>
                  <div className="p-6 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl hover:border-primary/30 transition-all group relative overflow-hidden h-full">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                         style={{ background: "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.06), transparent 50%)" }} />
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.2 }}
                      transition={{ duration: 0.6 }}
                      className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mb-4 shadow-md"
                    >
                      <item.icon className="h-5 w-5 text-primary-foreground" />
                    </motion.div>
                    <h3 className="font-display font-semibold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </MagneticCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-card/50">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl font-bold lg:text-4xl">Meet Our Team</h2>
            <p className="mt-3 text-lg text-muted-foreground">Hover to discover more about each team member</p>
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
                <FlipCard member={member} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Carousel with images */}
      <section className="py-20">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl font-bold lg:text-4xl">Our Solutions</h2>
            <p className="mt-3 text-lg text-muted-foreground">Explore the features powering JobAI</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Carousel />
          </motion.div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-14 border-y border-border/50">
        <div className="container text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">Trusted by leading companies worldwide</p>
          <motion.div
            className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {["Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix"].map((company) => (
              <motion.div
                key={company}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-card/60 backdrop-blur-lg opacity-70 hover:opacity-100 transition-opacity"
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-sm font-semibold text-muted-foreground">{company}</span>
              </motion.div>
            ))}
          </motion.div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-accent" /> 10,000+ Active Users</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-accent" /> 94% Match Accuracy</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-accent" /> SOC 2 Compliant</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <motion.div
            className="rounded-3xl overflow-hidden relative p-12 lg:p-16 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 gradient-hero" />
            <div className="absolute inset-0 bg-black/10" />
            <FloatingParticles />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-white lg:text-4xl">
                Ready to Find Your Next Opportunity?
              </h2>
              <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
                Join thousands of job seekers using AI to discover and match with their ideal positions.
              </p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="secondary" className="mt-8 text-base px-8 shadow-lg" asChild>
                  <Link to="/register">Create Free Account <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 JobAI — AI-Powered Intelligent Job Application Platform</p>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
        <div className="container mt-4 text-center text-xs text-muted-foreground">
          Abdullah Waheed & Arsalan Haider · IIU Islamabad
        </div>
      </footer>
      </div>
    </div>
  );
}
