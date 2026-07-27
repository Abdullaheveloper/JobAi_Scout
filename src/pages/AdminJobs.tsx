import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { MixedDir } from "@/components/MixedDir";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

export default function AdminJobs() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState("rss");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchJobs(page);
  }, [page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fetchSources = async () => {
    const { data: sourceData } = await (supabase as any)
      .from("job_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (sourceData) setSources(sourceData);
  };

  const fetchJobs = async (pageNum: number) => {
    setLoading(true);
    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await supabase
      .from("jobs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      toast({ title: t("admin.couldNotLoadJobs"), description: error.message, variant: "destructive" });
      setJobs([]);
      setTotalCount(0);
    } else {
      setJobs(data || []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  const addSource = async () => {
    if (!sourceName.trim() || !sourceUrl.trim()) return;
    const { error } = await (supabase as any).from("job_sources").insert({
      source_type: sourceType,
      name: sourceName.trim(),
      url: sourceUrl.trim(),
      enabled: true,
    });
    if (error) return toast({ title: t("admin.couldNotAddSource"), description: error.message, variant: "destructive" });
    setSourceName("");
    setSourceUrl("");
    toast({ title: t("admin.jobSourceAdded") });
    fetchSources();
  };

  const toggleSource = async (source: any) => {
    const { error } = await (supabase as any)
      .from("job_sources")
      .update({ enabled: !source.enabled })
      .eq("id", source.id);
    if (error) toast({ title: t("admin.couldNotUpdateSource"), description: error.message, variant: "destructive" });
    else fetchSources();
  };

  const deleteSource = async (id: string) => {
    const { error } = await (supabase as any).from("job_sources").delete().eq("id", id);
    if (error) toast({ title: t("admin.couldNotRemoveSource"), description: error.message, variant: "destructive" });
    else {
      toast({ title: t("admin.sourceRemoved") });
      fetchSources();
    }
  };

  const deleteJob = async (id: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("admin.jobDeleted") });
      const nextTotal = Math.max(0, totalCount - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
      } else {
        fetchJobs(page);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("admin.manageJobs")}</h1>
          <p className="text-muted-foreground mt-1">
            <MixedDir>{t("admin.manageJobsViewSubtitle")}</MixedDir>
          </p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold">{t("admin.collectionSources")}</h2>
              <p className="text-sm text-muted-foreground">
                <MixedDir>{t("admin.collectionSourcesHint")}</MixedDir>
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[160px_1fr_2fr_auto] items-end">
              <div>
                <Label>{t("admin.sourceType")}</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rss">{t("admin.sourceTypeRss")}</SelectItem>
                    <SelectItem value="company_career">{t("admin.sourceTypeCareer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("admin.sourceName")}</Label>
                <Input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder={t("admin.sourceNamePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("admin.sourceUrl")}</Label>
                <Input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={t("admin.sourceUrlPlaceholder")}
                  inputMode="url"
                  autoComplete="url"
                />
              </div>
              <Button onClick={addSource}>
                <Plus className="me-1 h-4 w-4" />
                {t("admin.add")}
              </Button>
            </div>
            {sources.length > 0 && (
              <div className="space-y-2">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Badge variant="outline">{source.source_type}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium"><MixedDir>{source.name}</MixedDir></p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">{source.url}</p>
                      {source.last_error ? (
                        <p className="mt-1 text-xs text-destructive">
                          <MixedDir>{t("admin.lastError", { error: source.last_error })}</MixedDir>
                        </p>
                      ) : source.last_collected_at ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <MixedDir>
                            {t("admin.lastCollected", {
                              when: new Date(source.last_collected_at).toLocaleString(),
                              count: source.last_result_count || 0,
                            })}
                          </MixedDir>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">{t("admin.notCollectedYet")}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleSource(source)}>
                      {source.enabled ? t("admin.enabled") : t("admin.disabled")}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSource(source.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">{t("admin.noJobsFound")}</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.colTitle")}</TableHead>
                      <TableHead>{t("admin.colCompany")}</TableHead>
                      <TableHead>{t("admin.colLocation")}</TableHead>
                      <TableHead>{t("admin.colSource")}</TableHead>
                      <TableHead>{t("admin.colStatus")}</TableHead>
                      <TableHead className="w-[80px]">{t("admin.colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium"><MixedDir>{job.title}</MixedDir></TableCell>
                        <TableCell><MixedDir>{job.company}</MixedDir></TableCell>
                        <TableCell><MixedDir>{job.location || "—"}</MixedDir></TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.is_active ? "default" : "secondary"}>
                            {job.is_active ? t("admin.active") : t("admin.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteJob(job.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
                  <p className="text-sm text-muted-foreground">
                    {t("admin.showingRange", { start: rangeStart, end: rangeEnd, total: totalCount })}
                  </p>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {t("admin.previous")}
                      </Button>
                      <span className="text-sm text-muted-foreground" dir="ltr">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages || loading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        {t("admin.next")}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
