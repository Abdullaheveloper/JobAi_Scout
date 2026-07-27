import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { hasExtractedCvData, type ExtractedData } from "@/lib/cv-extracted-data";
import {
  FileUp, MapPin, Mail, Phone, Linkedin, Github, FileText, Globe, Building2,
  GraduationCap, Award, Languages, ArrowRight, Briefcase, Sparkles,
} from "lucide-react";

type ExtractedDataCardProps = {
  data: ExtractedData | null;
  title?: string;
  description?: string;
};

export default function ExtractedDataCard({
  data,
  title = "Extracted CV Data",
  description = "Data automatically extracted from your resume by AI",
}: ExtractedDataCardProps) {
  if (!data || !hasExtractedCvData(data)) return null;

  return (
    <Card className="shadow-card border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-violet-500/3 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-violet-400">
          <FileText className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.fullName && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-muted">
            <FileUp className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Full Name</span>
              <p className="text-sm text-violet-800 dark:text-violet-200">{data.fullName}</p>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {data.email && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <Mail className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">Email</span>
                <p className="text-xs text-violet-800 dark:text-violet-200">{data.email}</p>
              </div>
            </div>
          )}
          {data.phone && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <Phone className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">Phone</span>
                <p className="text-xs text-violet-800 dark:text-violet-200">{data.phone}</p>
              </div>
            </div>
          )}
          {data.location && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <MapPin className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">Location</span>
                <p className="text-xs text-violet-800 dark:text-violet-200">{data.location}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {data.linkedinUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <Linkedin className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">LinkedIn</span>
                <p className="text-xs text-violet-800 dark:text-violet-200 truncate">{data.linkedinUrl}</p>
              </div>
            </div>
          )}
          {data.githubUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <Github className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">GitHub</span>
                <p className="text-xs text-violet-800 dark:text-violet-200 truncate">{data.githubUrl}</p>
              </div>
            </div>
          )}
          {data.portfolioUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-muted">
              <Globe className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-muted-foreground">Portfolio</span>
                <p className="text-xs text-violet-800 dark:text-violet-200 truncate">{data.portfolioUrl}</p>
              </div>
            </div>
          )}
        </div>

        {data.currentCompany && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-muted">
            <Building2 className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-medium text-muted-foreground">Current Company</span>
              <p className="text-sm text-violet-800 dark:text-violet-200">{data.currentCompany}</p>
            </div>
          </div>
        )}

        {data.experienceYears && data.experienceYears > 0 && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-muted">
            <Briefcase className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-medium text-muted-foreground">Experience</span>
              <p className="text-sm text-violet-800 dark:text-violet-200">{data.experienceYears} years</p>
            </div>
          </div>
        )}

        {data.experience && data.experience.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Roles & projects ({data.experience.length})</span>
            </div>
            <div className="space-y-2.5">
              {data.experience.map((entry, index) => {
                const type = entry.type || "job";
                const typeClass = type === "internship"
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                  : type === "project"
                    ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                    : "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20";
                return (
                  <div key={`${entry.title || "entry"}-${index}`} className="rounded-md border border-border bg-muted/50 p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm text-violet-800 dark:text-violet-200 font-medium">{entry.title || "Untitled"}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize ${typeClass}`}>{type}</Badge>
                    </div>
                    {(entry.company || entry.dates) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[entry.company, entry.dates].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {entry.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line leading-relaxed">{entry.description}</p>
                    )}
                    {entry.url && (
                      <p className="text-[11px] text-cyan-300/80 mt-1 truncate">{entry.url}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.education && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Education</span>
            </div>
            <p className="text-sm text-violet-800 dark:text-violet-200">{data.education}</p>
          </div>
        )}

        {data.skills && data.skills.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Skills ({data.skills.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <Badge key={s} variant="outline" className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/20">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.suggestedRoles && data.suggestedRoles.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Suggested Roles ({data.suggestedRoles.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.suggestedRoles.map((r) => (
                <Badge key={r} variant="outline" className="text-xs bg-cyan-500/10 text-cyan-300 border-cyan-500/20">{r}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.certifications && data.certifications.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Certifications ({data.certifications.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.certifications.map((c) => (
                <Badge key={c} variant="outline" className="text-xs bg-amber-500/10 text-amber-300 border-amber-500/20">{c}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.languages && data.languages.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Languages className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">Languages ({data.languages.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.languages.map((l) => (
                <Badge key={l} variant="outline" className="text-xs bg-rose-500/10 text-rose-300 border-rose-500/20">{l}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.cvSummary && (
          <div className="rounded-lg p-4 border border-violet-500/15 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">CV Summary</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{data.cvSummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
