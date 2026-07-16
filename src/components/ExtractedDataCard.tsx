import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { hasExtractedCvData, type ExtractedData } from "@/lib/cv-extracted-data";
import {
  FileUp, MapPin, Mail, Phone, Linkedin, Github, FileText, Globe, Building2,
  GraduationCap, Award, Languages, ArrowRight, Briefcase, Sparkles, Bot, ShieldCheck,
} from "lucide-react";

function DataSourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  if (source === "ai") {
    return (
      <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-300 border-cyan-500/20 gap-0.5">
        <Bot className="h-2.5 w-2.5" /> AI
      </Badge>
    );
  }
  if (source === "user") {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20 gap-0.5">
        <ShieldCheck className="h-2.5 w-2.5" /> You
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{source}</Badge>;
}

type ExtractedDataCardProps = {
  data: ExtractedData | null;
  title?: string;
  description?: string;
  dataSources?: Record<string, string>;
};

export default function ExtractedDataCard({
  data,
  title = "Extracted CV Data",
  description = "Data automatically extracted from your resume by AI",
  dataSources,
}: ExtractedDataCardProps) {
  if (!data || !hasExtractedCvData(data)) return null;

  const src = (key: string) => dataSources?.[key];

  return (
    <Card className="shadow-card border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-violet-500/3 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-violet-400">
          <FileText className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription className="text-violet-200/40">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.fullName && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <FileUp className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">Full Name</span>
                <DataSourceBadge source={src("full_name")} />
              </div>
              <p className="text-sm text-violet-200">{data.fullName}</p>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {data.email && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <Mail className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">Email</span>
                  <DataSourceBadge source={src("email")} />
                </div>
                <p className="text-xs text-violet-200">{data.email}</p>
              </div>
            </div>
          )}
          {data.phone && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <Phone className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">Phone</span>
                  <DataSourceBadge source={src("phone")} />
                </div>
                <p className="text-xs text-violet-200">{data.phone}</p>
              </div>
            </div>
          )}
          {data.location && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <MapPin className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">Location</span>
                  <DataSourceBadge source={src("location")} />
                </div>
                <p className="text-xs text-violet-200">{data.location}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {data.linkedinUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <Linkedin className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">LinkedIn</span>
                  <DataSourceBadge source={src("linkedin_url")} />
                </div>
                <p className="text-xs text-violet-200 truncate">{data.linkedinUrl}</p>
              </div>
            </div>
          )}
          {data.githubUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <Github className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">GitHub</span>
                  <DataSourceBadge source={src("github_url")} />
                </div>
                <p className="text-xs text-violet-200 truncate">{data.githubUrl}</p>
              </div>
            </div>
          )}
          {data.portfolioUrl && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-violet-500/15 bg-[#0d1230]/60">
              <Globe className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">Portfolio</span>
                  <DataSourceBadge source={src("portfolio_url")} />
                </div>
                <p className="text-xs text-violet-200 truncate">{data.portfolioUrl}</p>
              </div>
            </div>
          )}
        </div>

        {data.currentCompany && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <Building2 className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">Current Company</span>
                <DataSourceBadge source={src("current_company")} />
              </div>
              <p className="text-sm text-violet-200">{data.currentCompany}</p>
            </div>
          </div>
        )}

        {data.experienceYears && data.experienceYears > 0 && (
          <div className="flex items-start gap-3 rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <Briefcase className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">Experience</span>
                <DataSourceBadge source={src("experience_years")} />
              </div>
              <p className="text-sm text-violet-200">{data.experienceYears} years</p>
            </div>
          </div>
        )}

        {data.education && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Education</span>
              <DataSourceBadge source={src("education")} />
            </div>
            <p className="text-sm text-violet-200">{data.education}</p>
          </div>
        )}

        {data.skills && data.skills.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Skills ({data.skills.length})</span>
              <DataSourceBadge source={src("skills")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <Badge key={s} variant="outline" className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/20">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.suggestedRoles && data.suggestedRoles.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Suggested Roles ({data.suggestedRoles.length})</span>
              <DataSourceBadge source={src("desired_roles")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.suggestedRoles.map((r) => (
                <Badge key={r} variant="outline" className="text-xs bg-cyan-500/10 text-cyan-300 border-cyan-500/20">{r}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.certifications && data.certifications.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Certifications ({data.certifications.length})</span>
              <DataSourceBadge source={src("certifications")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.certifications.map((c) => (
                <Badge key={c} variant="outline" className="text-xs bg-amber-500/10 text-amber-300 border-amber-500/20">{c}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.languages && data.languages.length > 0 && (
          <div className="rounded-lg p-3 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-2">
              <Languages className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Languages ({data.languages.length})</span>
              <DataSourceBadge source={src("languages")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.languages.map((l) => (
                <Badge key={l} variant="outline" className="text-xs bg-rose-500/10 text-rose-300 border-rose-500/20">{l}</Badge>
              ))}
            </div>
          </div>
        )}

        {data.cvSummary && (
          <div className="rounded-lg p-4 border border-violet-500/15 bg-[#0d1230]/60">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">CV Summary</span>
              <DataSourceBadge source={src("cv_summary")} />
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{data.cvSummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
