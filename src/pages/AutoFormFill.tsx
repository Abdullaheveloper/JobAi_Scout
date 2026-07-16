import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Chrome, Download, CheckCircle2, ArrowRight, Zap, Shield, Clock,
  FileText, User, Mail, Phone, MapPin, Linkedin, Github, Globe, Briefcase,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant Auto-Fill",
    desc: "Fills job application forms in one click using your saved profile data.",
  },
  {
    icon: Shield,
    title: "Smart Detection",
    desc: "Detects 50+ field types across LinkedIn, Indeed, Glassdoor, and more.",
  },
  {
    icon: Clock,
    title: "Save Hours",
    desc: "Skip repetitive form filling — apply to more jobs in less time.",
  },
];

const FIELDS_FILLED = [
  { icon: User, label: "Full Name" },
  { icon: Mail, label: "Email Address" },
  { icon: Phone, label: "Phone Number" },
  { icon: MapPin, label: "Location / Address" },
  { icon: Linkedin, label: "LinkedIn URL" },
  { icon: Github, label: "GitHub URL" },
  { icon: Globe, label: "Portfolio URL" },
  { icon: FileText, label: "Cover Letter" },
  { icon: Briefcase, label: "Work Experience" },
  { icon: Sparkles, label: "Skills & Education" },
];

const STEPS = [
  "Download and extract the Job Form Fill extension from above",
  "Open Chrome → go to chrome://extensions/ → enable Developer Mode",
  "Click 'Load unpacked' and select the extracted extension folder",
  "Log in with your JobAI account inside the extension",
  "Visit any job application form (LinkedIn, Greenhouse, Lever, etc.)",
  "Click the extension icon → Auto Fill to complete the form instantly",
];

export default function AutoFormFill() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    fetch("/job-form-fill.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "job-form-fill.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {})
      .finally(() => setDownloading(false));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 md:p-10 shadow-card">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Zap className="h-3.5 w-3.5" /> Browser Extension
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Job Auto Form Fill
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-lg">
              Automatically fill job application forms with your profile data. One click, every field filled.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button onClick={handleDownload} disabled={downloading} size="lg" className="gradient-primary border-0 gap-2">
                <Download className="h-5 w-5" />
                {downloading ? "Downloading..." : "Download Extension"}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#setup-guide">
                  View Setup Guide <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">v2.0.0</Badge>
              <span>Chrome, Edge, Brave, Opera</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="shadow-card hover:shadow-card-hover transition-all group">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Fields Auto-Filled */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-primary" /> Fields Automatically Filled
            </CardTitle>
            <CardDescription>
              The extension detects and fills these fields across job portals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {FIELDS_FILLED.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <f.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{f.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Setup Guide */}
        <Card id="setup-guide" className="shadow-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Chrome className="h-5 w-5 text-primary" /> Setup Guide
            </CardTitle>
            <CardDescription>Follow these steps to get started in under 2 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 pt-4 border-t border-border">
              <Button onClick={handleDownload} disabled={downloading} className="gap-2">
                <Download className="h-4 w-4" />
                {downloading ? "Downloading..." : "Download Extension Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Supported Portals */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Globe className="h-5 w-5 text-primary" /> Supported Job Portals
            </CardTitle>
            <CardDescription>Works across all major job platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["LinkedIn", "Indeed", "Glassdoor", "Monster", "Bayt", "Rozee", "Wellfound", "Dice", "CareerBuilder", "Greenhouse", "Lever", "Workday"].map(
                (portal) => (
                  <Badge key={portal} variant="outline" className="px-3 py-1.5 text-sm font-normal hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors cursor-default">
                    {portal}
                  </Badge>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
