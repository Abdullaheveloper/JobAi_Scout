import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Shield, ArrowLeft } from "lucide-react";

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly: name, email address, phone number, resume/CV data, LinkedIn and GitHub profile links. We also collect usage data such as pages visited, features used, and job applications submitted. Device information including browser type, IP address, and operating system may be collected automatically.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `Your data is used to: provide AI-powered job matching and recommendations, process job applications on your behalf, enable recruiter-candidate communication, improve our algorithms and platform features, send relevant job alerts and platform updates (with your consent), and ensure platform security and prevent fraud.`,
  },
  {
    title: "3. AI & Data Processing",
    content: `Our AI analyzes your CV/resume to extract skills, experience, and qualifications for job matching. This processing is automated but you can request human review of any AI-generated recommendations. We do not sell your data to third parties or use it for purposes outside of job matching and platform improvement.`,
  },
  {
    title: "4. Data Sharing",
    content: `We share your profile information with recruiters only when you apply for a job or opt in to be discoverable. Recruiter data is shared with job seekers through job postings. We may share anonymized, aggregated data for analytics. We do not sell personal data to advertisers or data brokers.`,
  },
  {
    title: "5. Data Security",
    content: `We implement industry-standard security measures including encryption in transit (TLS/SSL) and at rest, role-based access controls, regular security audits, and secure cloud infrastructure. Despite our efforts, no method of transmission over the Internet is 100% secure.`,
  },
  {
    title: "6. Your Rights",
    content: `You have the right to: access your personal data, correct inaccurate data, delete your account and associated data, export your data in a portable format, opt out of marketing communications, and withdraw consent for data processing. To exercise these rights, contact us at privacy@jobai.com.`,
  },
  {
    title: "7. Cookies & Tracking",
    content: `We use essential cookies for authentication and session management. Analytics cookies help us understand platform usage (you can opt out). We do not use third-party advertising cookies.`,
  },
  {
    title: "8. Data Retention",
    content: `Active account data is retained as long as your account exists. Deleted account data is purged within 30 days. Application history is retained for 12 months after account deletion for legal compliance. Anonymized analytics data may be retained indefinitely.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this policy periodically. We will notify you of significant changes via email or platform notification. Continued use of JobAI after changes constitutes acceptance.`,
  },
  {
    title: "10. Contact Us",
    content: `For privacy-related inquiries: Email privacy@jobai.com, or visit our Contact page. Data Protection Officer: Abdullah Waheed, IIU Islamabad, H-10, Islamabad, Pakistan.`,
  },
];

export default function Privacy() {
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
            <Button variant="ghost" asChild><Link to="/about">About</Link></Button>
            <Button asChild><Link to="/register">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      <section className="py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <Button variant="ghost" size="sm" className="mb-6" asChild>
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
            </Button>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm">
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Legal
            </Badge>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">
              Privacy <span className="text-gradient">Policy</span>
            </h1>
            <p className="mt-4 text-muted-foreground">
              Last updated: April 5, 2026
            </p>
          </div>

          <div className="space-y-8">
            <p className="text-muted-foreground leading-relaxed">
              At JobAI, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our AI-powered job matching platform.
            </p>

            {sections.map((section) => (
              <div key={section.title} className="border-b border-border pb-6 last:border-0">
                <h2 className="font-display text-lg font-semibold mb-3">{section.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
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
