import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Building2, MapPin, Clock, ExternalLink, FileText, Calendar } from "lucide-react";

interface Application {
  id: string;
  applied_at: string;
  cover_letter: string | null;
  status: string | null;
  job_id: string;
  jobs: {
    title: string;
    company: string;
    location: string | null;
    job_type: string | null;
    job_url: string | null;
    salary_min: number | null;
    salary_max: number | null;
  } | null;
}

export default function Applications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  useEffect(() => {
    if (user) fetchApplications();
  }, [user]);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, applied_at, cover_letter, status, job_id, jobs(title, company, location, job_type, job_url, salary_min, salary_max)")
      .eq("user_id", user!.id)
      .order("applied_at", { ascending: false });

    if (data) setApplications(data as unknown as Application[]);
    if (error) console.error("Fetch applications error:", error);
    setLoading(false);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "sent": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "applied": return "bg-primary/10 text-primary border-primary/20";
      case "interview": return "bg-amber-500/10 text-amber-600 border-amber-200";
      case "accepted": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "rejected": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">My Applications</h1>
          <p className="text-muted-foreground mt-1">Track all jobs you've applied to</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : applications.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">No applications yet</h3>
              <p className="text-muted-foreground mt-1">Apply to jobs from the Browse Jobs page to see them here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium">{applications.length} application{applications.length !== 1 ? "s" : ""}</span>
            </div>
            {applications.map((app) => {
              const job = app.jobs;
              const salary = job ? formatSalary(job.salary_min, job.salary_max) : null;
              return (
                <Card key={app.id} className="shadow-card hover:shadow-card-hover transition-all group cursor-pointer" onClick={() => setSelectedApp(app)}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                            {job?.title || "Unknown Job"}
                          </h3>
                          <Badge variant="outline" className={getStatusColor(app.status)}>
                            {app.status || "applied"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job?.company || "Unknown"}</span>
                          {job?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                          {job?.job_type && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{job.job_type}</span>}
                          {salary && <span className="flex items-center gap-1">{salary}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(app.applied_at).toLocaleDateString()}
                          </span>
                        </div>
                        {app.cover_letter && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{app.cover_letter}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {job?.job_url && (
                          <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); window.open(job.job_url!, "_blank"); }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Job
                          </Button>
                        )}
                        {app.cover_letter && (
                          <Button variant="ghost" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}>
                            <FileText className="h-3.5 w-3.5" />
                            Cover Letter
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {selectedApp?.jobs?.title || "Application Details"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedApp?.jobs?.company}{selectedApp?.jobs?.location ? ` • ${selectedApp.jobs.location}` : ""}
              {" • Applied "}
              {selectedApp ? new Date(selectedApp.applied_at).toLocaleDateString() : ""}
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <Badge variant="outline" className={getStatusColor(selectedApp?.status || null)}>
                {selectedApp?.status || "applied"}
              </Badge>
            </div>
            {selectedApp?.cover_letter && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Cover Letter</h4>
                <ScrollArea className="h-[300px] border rounded-md p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedApp.cover_letter}</p>
                </ScrollArea>
              </div>
            )}
            {selectedApp?.jobs?.job_url && (
              <Button className="gradient-primary border-0 gap-2 w-full" onClick={() => window.open(selectedApp.jobs!.job_url!, "_blank")}>
                <ExternalLink className="h-4 w-4" />
                Open Job Listing
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
