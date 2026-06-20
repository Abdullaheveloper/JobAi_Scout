import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, Sparkles, CheckCircle2, Upload, MapPin, Mail, Phone, Linkedin, Github, FileText } from "lucide-react";

export default function CVUpload() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type === "application/pdf" || dropped.name.endsWith(".docx") || dropped.name.endsWith(".doc"))) {
      setFile(dropped);
    } else {
      toast({ title: "Invalid file", description: "Please upload a PDF or DOCX file.", variant: "destructive" });
    }
  }, [toast]);

  const handleUploadAndAnalyze = async () => {
    if (!file || !user) return;
    setUploading(true);

    // Upload to storage
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    // Update profile with resume URL
    await supabase.from("profiles").update({ resume_url: filePath }).eq("user_id", user.id);

    setUploading(false);
    setAnalyzing(true);

    // Call AI analysis edge function
    try {
      const { data, error } = await supabase.functions.invoke("analyze-cv", {
        body: { fileName: file.name, filePath },
      });

      if (error) throw error;

      if (data?.skills && data?.suggestedRoles) {
        await supabase.from("profiles").update({
          skills: data.skills,
          desired_roles: data.suggestedRoles,
          experience_years: data.experienceYears || 0,
          ...(data.fullName ? { full_name: data.fullName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
          ...(data.location ? { location: data.location } : {}),
          ...(data.linkedinUrl ? { linkedin_url: data.linkedinUrl } : {}),
          ...(data.githubUrl ? { github_url: data.githubUrl } : {}),
          ...(data.cvSummary ? { cv_summary: data.cvSummary } : {}),
        }).eq("user_id", user.id);

        await refreshProfile();
        toast({ title: "CV Analyzed!", description: `Extracted ${data.skills.length} skills, ${data.suggestedRoles.length} roles, and full profile data.` });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze CV", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const skills = profile?.skills || [];
  const desiredRoles = profile?.desired_roles || [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">CV Upload & Analysis</h1>
          <p className="text-muted-foreground mt-1">Upload your resume and let AI extract your skills</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-primary" /> Upload Resume
            </CardTitle>
            <CardDescription>Supported formats: PDF, DOCX</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => document.getElementById("cv-input")?.click()}
            >
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{file ? file.name : "Drop your CV here or click to browse"}</p>
              <p className="text-sm text-muted-foreground mt-1">PDF or DOCX, max 20MB</p>
              <input
                id="cv-input"
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
            </div>

            {file && (
              <Button onClick={handleUploadAndAnalyze} disabled={uploading || analyzing} className="mt-4 w-full">
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : analyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI Analyzing...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Upload & Analyze with AI</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {skills.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-success" /> AI Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Extracted Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary border-0">{skill}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Suggested Roles</h4>
                <div className="flex flex-wrap gap-2">
                  {desiredRoles.map((role: string) => (
                    <Badge key={role} variant="secondary" className="bg-accent/10 text-accent border-0">{role}</Badge>
                  ))}
                </div>
              </div>
              {profile?.experience_years ? (
                <div>
                  <h4 className="font-semibold mb-1">Experience</h4>
                  <p className="text-muted-foreground">{profile.experience_years} years</p>
                </div>
              ) : null}
              {(profile?.location || profile?.email || profile?.phone || profile?.linkedin_url || profile?.github_url) && (
                <div>
                  <h4 className="font-semibold mb-2">Contact & Links</h4>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>}
                    {profile.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{profile.email}</span>}
                    {profile.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
                    {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>}
                    {profile.github_url && <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Github className="h-3.5 w-3.5" />GitHub</a>}
                  </div>
                </div>
              )}
              {profile?.cv_summary && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> CV Summary</h4>
                  <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed bg-muted/50 rounded-lg p-4">{profile.cv_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
