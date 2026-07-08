import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Mail, Phone, MapPin, ArrowLeft, Send, Clock, MessageSquare, ArrowRight, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const contactInfo = [
  { icon: Mail, title: "Email Us", detail: "support@jobai.com", sub: "We reply within 24 hours", color: "from-indigo-500 to-violet-600", glow: "rgba(99,102,241,0.3)" },
  { icon: Phone, title: "Call Us", detail: "+92 51 123 4567", sub: "Mon-Fri 9AM-6PM PKT", color: "from-cyan-500 to-blue-600", glow: "rgba(6,182,212,0.3)" },
  { icon: MapPin, title: "Our Office", detail: "IIU Islamabad", sub: "H-10, Islamabad, Pakistan", color: "from-emerald-500 to-teal-600", glow: "rgba(16,185,129,0.3)" },
  { icon: Clock, title: "Business Hours", detail: "Mon - Fri", sub: "9:00 AM - 6:00 PM PKT", color: "from-violet-500 to-purple-600", glow: "rgba(139,92,246,0.3)" },
];

export default function Contact() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

  useEffect(() => {
    // Preload other main routes when the browser is idle to speed up navigation
    const preloadRoutes = () => {
      import("./Index").catch(() => {});
      import("./About").catch(() => {});
      import("./Login").catch(() => {});
      import("./Register").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(preloadRoutes);
    } else {
      setTimeout(preloadRoutes, 2000);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
      toast({ title: "Message sent! 🎉", description: "We'll get back to you within 24 hours." });
      setTimeout(() => setSent(false), 5000);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 1400);
  };

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
            <Link to="/about" className="nav-link-premium">About</Link>
            <Link to="/register" className="btn-premium text-sm">Get Started <ArrowRight className="inline h-4 w-4 ml-1" /></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-20 pointer-events-none" />
        <div className="absolute top-0 right-1/3 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-400 transition-colors mb-8">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="badge-premium mb-6 inline-flex">
              <MessageSquare className="h-3.5 w-3.5" /> Get in Touch
            </span>
          </motion.div>

          <motion.h1
            className="heading-xl text-white mb-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            Contact <span className="text-gradient">Us</span>
          </motion.h1>

          <motion.p
            className="body-lg text-gray-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Have a question or want to partner with us? We'd love to hear from you.
          </motion.p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="pb-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map((item, i) => (
              <motion.div
                key={item.title}
                className="premium-card p-5 text-center group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div
                  className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} shadow-lg group-hover:scale-110 transition-transform`}
                  style={{ boxShadow: `0 6px 20px ${item.glow}` }}
                >
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <p className="font-semibold text-white text-sm mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{item.title}</p>
                <p className="text-sm text-gray-300">{item.detail}</p>
                <p className="text-xs text-gray-600 mt-0.5">{item.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form + Map-like decorative */}
      <section className="py-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* FAQ / Info */}
            <motion.div
              className="lg:col-span-2 space-y-5"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <span className="overline block mb-3">Let's connect</span>
                <h2 className="heading-md text-white mb-4">We're here to help</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Whether you're a job seeker with questions about our AI matching, a recruiter looking to partner, or a company exploring enterprise plans — reach out.
                </p>
              </div>

              {[
                { q: "How quickly do you respond?", a: "We typically respond within 2-4 hours during business hours." },
                { q: "Do you offer enterprise plans?", a: "Yes! We have custom plans for companies with 50+ hires/year." },
                { q: "Is JobAI Scout free?", a: "Core features are free. Premium plans unlock advanced AI features." },
              ].map((faq, i) => (
                <motion.div
                  key={faq.q}
                  className="glass-card-sm rounded-xl p-4"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <p className="font-semibold text-white text-sm mb-1.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{faq.q}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Contact Form */}
            <motion.div
              className="lg:col-span-3"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="premium-card p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/30">
                    <Send className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Send us a message</h3>
                    <p className="text-xs text-gray-500">We'll get back to you within 24 hours</p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {sent ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h3 className="font-bold text-white text-xl mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Message Sent!</h3>
                      <p className="text-gray-400 text-sm">We'll get back to you within 24 hours. Check your email for confirmation.</p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-5"
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                          <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Your name"
                            required
                            className="input-premium w-full px-4 py-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                          <input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            required
                            className="input-premium w-full px-4 py-3 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Subject</label>
                        <input
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          placeholder="How can we help?"
                          required
                          className="input-premium w-full px-4 py-3 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Message</label>
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us more about your needs..."
                          rows={5}
                          required
                          className="input-premium w-full px-4 py-3 text-sm resize-none"
                        />
                      </div>

                      <motion.button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-premium py-3.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                      >
                        {loading ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send Message
                          </>
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-premium py-10 mt-8">
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
