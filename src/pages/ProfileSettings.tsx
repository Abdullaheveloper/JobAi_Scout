import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, User, Phone, Linkedin, Github, Mail, Briefcase, Sparkles, MapPin, FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    bio: "",
    linkedin_url: "",
    github_url: "",
    skills: "",
    desired_roles: "",
    experience_years: 0,
    location: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        linkedin_url: profile.linkedin_url || "",
        github_url: profile.github_url || "",
        skills: (profile.skills || []).join(", "),
        desired_roles: (profile.desired_roles || []).join(", "),
        experience_years: profile.experience_years || 0,
        location: (profile as any).location || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      github_url: form.github_url.trim() || null,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      desired_roles: form.desired_roles ? form.desired_roles.split(",").map(s => s.trim()).filter(Boolean) : [],
      experience_years: Number(form.experience_years) || 0,
      location: form.location.trim() || null,
    } as any).eq("user_id", user.id);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
    }
    setSaving(false);
  };

  const skills = profile?.skills || [];
  const roles = profile?.desired_roles || [];
  const location = (profile as any)?.location || "";
  const resumeUrl = profile?.resume_url || "";

  // Profile completeness score
  const completenessItems = [
    { label: "Name", done: !!profile?.full_name },
    { label: "Email", done: !!profile?.email },
    { label: "Phone", done: !!profile?.phone },
    { label: "Location", done: !!location },
    { label: "Bio", done: !!profile?.bio },
    { label: "Skills", done: skills.length > 0 },
    { label: "Desired Roles", done: roles.length > 0 },
    { label: "Experience", done: (profile?.experience_years || 0) > 0 },
    { label: "Resume", done: !!resumeUrl },
    { label: "LinkedIn", done: !!profile?.linkedin_url },
  ];
  const completeness = Math.round((completenessItems.filter(i => i.done).length / completenessItems.length) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Update your personal and professional details. This data helps us find the best jobs for you.</p>
        </div>

        {/* Profile Completeness */}
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-semibold text-sm">Profile Completeness</span>
              <Badge variant={completeness === 100 ? "default" : "secondary"} className={completeness === 100 ? "gradient-primary border-0 text-primary-foreground" : ""}>
                {completeness}%
              </Badge>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${completeness}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {completenessItems.map(item => (
                <Badge key={item.label} variant="outline" className={`text-xs ${item.done ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                  {item.done ? "✓" : "✗"} {item.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Extracted Data Summary */}
        {(skills.length > 0 || roles.length > 0 || location) && (
          <Card className="shadow-card border-accent/20 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Sparkles className="h-5 w-5 text-accent" /> AI-Extracted Profile Data
              </CardTitle>
              <CardDescription>This data is used for personalized job scraping and matching</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Location:</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0">{location}</Badge>
                </div>
              )}
              {skills.length > 0 && (
                <div>
                  <span className="text-sm font-medium flex items-center gap-1.5 mb-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Skills ({skills.length})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s: string) => <Badge key={s} variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{s}</Badge>)}
                  </div>
                </div>
              )}
              {roles.length > 0 && (
                <div>
                  <span className="text-sm font-medium flex items-center gap-1.5 mb-1.5"><Briefcase className="h-3.5 w-3.5 text-accent" /> Target Roles ({roles.length})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r: string) => <Badge key={r} variant="secondary" className="bg-accent/10 text-accent border-0 text-xs">{r}</Badge>)}
                  </div>
                </div>
              )}
              {resumeUrl && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Resume:</span>
                  <Badge variant="secondary" className="bg-accent/10 text-accent border-0 text-xs">Uploaded ✓</Badge>
                </div>
              )}
              {profile?.cv_summary && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <span className="text-sm font-medium flex items-center gap-1.5 mb-2"><FileText className="h-3.5 w-3.5 text-primary" /> CV Summary</span>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/30 rounded-md p-3">{profile.cv_summary}</p>
                </div>
              )}
              {(profile?.experience_years || 0) > 0 && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Experience:</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0">{profile.experience_years} years</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
            <CardDescription>Your basic contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Full Name
                </Label>
                <Input id="full_name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input id="email" value={form.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone Number
                </Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={e => {
                    const filtered = e.target.value.replace(/[a-zA-Z]/g, "");
                    setForm(f => ({ ...f, phone: filtered }));
                  }}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </Label>
                <Input id="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="New York, NY" />
                <p className="text-xs text-muted-foreground">Used for location-based job scraping</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experience" className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Experience (years)
                </Label>
                <Input id="experience" type="number" min={0} value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell us about yourself..." rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Linkedin className="h-5 w-5 text-primary" /> Social Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn URL
              </Label>
              <Input id="linkedin" value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/yourprofile" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github" className="flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" /> GitHub URL
              </Label>
              <Input id="github" value={form.github_url} onChange={e => setForm(f => ({ ...f, github_url: e.target.value }))} placeholder="https://github.com/yourusername" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-primary" /> Skills & Roles
            </CardTitle>
            <CardDescription>Comma-separated values. AI analysis will also populate these.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Textarea id="skills" value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="React, TypeScript, Node.js, Python..." rows={2} />
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skills.map((s: string) => <Badge key={s} variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{s}</Badge>)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles">Desired Roles</Label>
              <Textarea id="roles" value={form.desired_roles} onChange={e => setForm(f => ({ ...f, desired_roles: e.target.value }))} placeholder="Frontend Developer, Full Stack Engineer..." rows={2} />
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roles.map((r: string) => <Badge key={r} variant="secondary" className="bg-accent/10 text-accent border-0 text-xs">{r}</Badge>)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
        </Button>
      </div>
    </DashboardLayout>
  );
}
