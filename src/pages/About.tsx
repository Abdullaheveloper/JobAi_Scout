import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, Target, Award, ArrowLeft, Globe, Zap, Shield } from "lucide-react";

const teamMembers = [
  { name: "Abdullah Waheed", role: "Co-Founder & Lead Developer", bio: "Full-stack engineer passionate about AI-driven recruitment solutions." },
  { name: "Arsalan Haider", role: "Co-Founder & Product Lead", bio: "Product strategist focused on building scalable hiring platforms." },
];

const stats = [
  { label: "Active Users", value: "10,000+" },
  { label: "Jobs Matched", value: "50,000+" },
  { label: "Companies Trust Us", value: "500+" },
  { label: "Success Rate", value: "94%" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Briefcase className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">JobAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/contact">Contact</Link></Button>
            <Button asChild><Link to="/register">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="container relative text-center max-w-3xl">
          <Button variant="ghost" size="sm" className="mb-6" asChild>
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
          </Button>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Award className="mr-1.5 h-3.5 w-3.5" /> Our Story
          </Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight lg:text-5xl">
            Building the Future of <span className="text-gradient">AI Recruitment</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            JobAI was founded at IIU Islamabad with a mission to bridge the gap between talent and opportunity
            using cutting-edge artificial intelligence and modern recruitment practices.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-extrabold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <div className="grid gap-12 md:grid-cols-3">
            {[
              { icon: Target, title: "Our Mission", desc: "Democratize job searching by making AI-powered matching accessible to every job seeker and recruiter worldwide." },
              { icon: Globe, title: "Our Vision", desc: "A world where finding the right job — or the right candidate — takes minutes, not months." },
              { icon: Shield, title: "Our Values", desc: "Transparency, data privacy, and fairness in AI. We build ethical technology that serves everyone equally." },
            ].map((item) => (
              <div key={item.title} className="text-center p-6 rounded-2xl border border-border">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-16 bg-card border-y border-border">
        <div className="container text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">Trusted by leading companies</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
            {["Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix"].map((company) => (
              <div key={company} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-sm font-semibold text-muted-foreground">{company}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="container max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold mb-4">Meet the Team</h2>
          <p className="text-muted-foreground mb-12">The minds behind JobAI</p>
          <div className="grid gap-8 sm:grid-cols-2">
            {teamMembers.map((member) => (
              <div key={member.name} className="p-6 rounded-2xl border border-border hover:shadow-card-hover transition-all">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold">{member.name}</h3>
                <p className="text-sm text-primary font-medium">{member.role}</p>
                <p className="mt-2 text-sm text-muted-foreground">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <div className="rounded-3xl gradient-hero p-10 lg:p-14 text-center">
            <h2 className="font-display text-2xl font-bold text-primary-foreground lg:text-3xl">
              Ready to Transform Your Hiring?
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-lg mx-auto">
              Join thousands of job seekers and recruiters already using JobAI.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/register">Create Free Account</Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" asChild>
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 JobAI — AI-Powered Intelligent Job Application Platform</p>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
