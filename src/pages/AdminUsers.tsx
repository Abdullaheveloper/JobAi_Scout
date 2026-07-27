import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, ShieldOff, Loader2, Briefcase, CheckCircle2, XCircle,
  Linkedin, Github, Pencil, Check, X, Trash2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { MixedDir } from "@/components/MixedDir";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";

type ApprovalFilter = "all" | "pending" | "approved" | "rejected" | "expired";

const approvalBadgeClass: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  expired: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const FILTER_IDS: ApprovalFilter[] = ["all", "pending", "approved", "rejected", "expired"];

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const tableDir = isRtlLocale(resolveLocale(i18n.resolvedLanguage || i18n.language)) ? "rtl" : "ltr";
  const filterLabels: Record<ApprovalFilter, string> = {
    all: t("admin.filterAll"),
    pending: t("admin.filterPending"),
    approved: t("admin.filterApproved"),
    rejected: t("admin.filterRejected"),
    expired: t("admin.filterExpired"),
  };
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get("filter") as ApprovalFilter | null;
  const filter: ApprovalFilter =
    filterParam && FILTER_IDS.includes(filterParam) ? filterParam : "all";

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    bio: "",
    linkedin_url: "",
    github_url: "",
    skills: "",
    desired_roles: "",
    experience_years: "",
  });
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const pendingCount = useMemo(
    () => users.filter((u) => u.approval_status === "pending").length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    if (filter === "all") return users;
    return users.filter((u) => (u.approval_status || "approved") === filter);
  }, [users, filter]);

  const setFilter = (next: ApprovalFilter) => {
    if (next === "all") {
      searchParams.delete("filter");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ filter: next }, { replace: true });
    }
  };

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, appsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("job_applications").select("user_id"),
    ]);
    if (profilesRes.data) {
      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const appCountMap = new Map<string, number>();
      (appsRes.data || []).forEach((a: any) => {
        appCountMap.set(a.user_id, (appCountMap.get(a.user_id) || 0) + 1);
      });
      setUsers(
        profilesRes.data.map((p: any) => ({
          ...p,
          _role: roleMap.get(p.user_id) || "user",
          _appCount: appCountMap.get(p.user_id) || 0,
        }))
      );
    }
    setLoading(false);
  };

  const toggleRole = async (targetUserId: string, currentRole: string) => {
    if (targetUserId === user?.id) {
      toast({ title: t("admin.cannotChangeOwnRole"), variant: "destructive" });
      return;
    }
    const newRole = currentRole === "admin" ? "user" : "admin";
    setUpdating(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-role", {
        body: { targetUserId, newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: t("admin.roleUpdated", {
          role: newRole === "admin" ? t("admin.roleAdmin") : t("admin.roleUser"),
        }),
      });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: t("admin.failedUpdateRole"), description: err.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const setApproval = async (targetUserId: string, status: "approved" | "rejected") => {
    if (targetUserId === user?.id) {
      toast({ title: t("admin.cannotChangeOwnApproval"), variant: "destructive" });
      return;
    }
    setApproving(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_account_approval", {
        p_user_id: targetUserId,
        p_status: status,
      });
      if (error) throw error;
      toast({ title: status === "approved" ? t("admin.userApproved") : t("admin.userRejected") });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: t("admin.approvalFailed"), description: err.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      bio: u.bio || "",
      linkedin_url: u.linkedin_url || "",
      github_url: u.github_url || "",
      skills: (u.skills || []).join(", "),
      desired_roles: (u.desired_roles || []).join(", "),
      experience_years: u.experience_years?.toString() || "",
    });
    setEditOpen(true);
  };

  const openDelete = (u: any) => {
    setDeleteTarget(u);
    setDeleteConfirm("");
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: {
          targetUserId: deleteTarget.user_id,
          confirmation: deleteConfirm.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t("admin.userDeleted"),
        description: data?.message || undefined,
      });
      setUsers((prev) => prev.filter((u) => u.user_id !== deleteTarget.user_id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch (err: any) {
      toast({ title: t("admin.deleteFailed"), description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const updates: any = {
        full_name: editForm.full_name.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        bio: editForm.bio.trim() || null,
        linkedin_url: editForm.linkedin_url.trim() || null,
        github_url: editForm.github_url.trim() || null,
        skills: editForm.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
        desired_roles: editForm.desired_roles.split(",").map((s: string) => s.trim()).filter(Boolean),
        experience_years: editForm.experience_years ? parseInt(editForm.experience_years) : null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", editUser.user_id);

      if (error) throw error;
      toast({ title: t("admin.profileUpdated") });
      setEditOpen(false);
      await fetchUsers();
    } catch (err: any) {
      toast({ title: t("admin.failedSave"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmValid =
    !!deleteTarget &&
    (deleteConfirm.trim() === "Yes, delete permanently" ||
      (!!deleteTarget.email &&
        deleteConfirm.trim().toLowerCase() === String(deleteTarget.email).toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("admin.manageUsers")}</h1>
          <p className="text-muted-foreground mt-1">
            <MixedDir>{t("admin.manageUsersSubtitle")}</MixedDir>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTER_IDS.map((id) => {
            const count =
              id === "all"
                ? users.length
                : users.filter((u) => (u.approval_status || "approved") === id).length;
            const active = filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                  active
                    ? id === "pending"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-200"
                      : "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <bdi className="inline-flex items-center gap-2">
                  {filterLabels[id]}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      id === "pending" && count > 0
                        ? "bg-amber-500 text-black"
                        : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                </bdi>
              </button>
            );
          })}
          {pendingCount > 0 && filter !== "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              onClick={() => setFilter("pending")}
            >
              {t("admin.reviewPending", { count: pendingCount })}
            </Button>
          )}
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("admin.noUsersMatch")}
              </p>
            ) : (
              <Table dir={tableDir}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.colName")}</TableHead>
                    <TableHead>{t("admin.colEmail")}</TableHead>
                    <TableHead>{t("admin.colPhone")}</TableHead>
                    <TableHead>{t("admin.colLinks")}</TableHead>
                    <TableHead>{t("admin.colRole")}</TableHead>
                    <TableHead>{t("admin.colApproval")}</TableHead>
                    <TableHead>{t("admin.colSignup")}</TableHead>
                    <TableHead>{t("admin.colExperience")}</TableHead>
                    <TableHead>{t("admin.colSkills")}</TableHead>
                    <TableHead>{t("admin.colDesiredRoles")}</TableHead>
                    <TableHead>{t("admin.colResume")}</TableHead>
                    <TableHead>{t("admin.colBio")}</TableHead>
                    <TableHead>{t("admin.colReadiness")}</TableHead>
                    <TableHead>{t("admin.colApplications")}</TableHead>
                    <TableHead>{t("admin.colLastUpdated")}</TableHead>
                    <TableHead>{t("admin.colJoined")}</TableHead>
                    <TableHead className="text-end">{t("admin.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isCurrentUser = u.user_id === user?.id;
                    const isAdmin = u._role === "admin";
                    const approval = u.approval_status || "approved";
                    const getCompleteness = () => {
                      let score = 0;
                      if (u.full_name) score += 15;
                      if (u.email) score += 10;
                      if (u.phone) score += 10;
                      if (u.resume_url) score += 20;
                      if ((u.skills || []).length > 0) score += 10;
                      if ((u.desired_roles || []).length > 0) score += 10;
                      if (u.experience_years != null) score += 5;
                      if (u.bio) score += 5;
                      if (u.linkedin_url) score += 10;
                      if (u.github_url) score += 5;
                      return score;
                    };
                    const completeness = getCompleteness();
                    return (
                      <TableRow key={u.id} className={approval === "pending" ? "bg-amber-500/5" : undefined}>
                        <TableCell className="font-medium"><MixedDir>{u.full_name || "—"}</MixedDir></TableCell>
                        <TableCell className="text-sm"><MixedDir>{u.email}</MixedDir></TableCell>
                        <TableCell className="text-sm" dir="ltr">{u.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {u.linkedin_url && (
                              <a href={u.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Linkedin className="h-4 w-4" />
                              </a>
                            )}
                            {u.github_url && (
                              <a href={u.github_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Github className="h-4 w-4" />
                              </a>
                            )}
                            {!u.linkedin_url && !u.github_url && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAdmin ? "default" : "secondary"} className={isAdmin ? "gradient-primary border-0" : ""}>
                            {u._role === "admin"
                              ? t("admin.roleAdmin")
                              : u._role === "recruiter"
                                ? t("admin.roleRecruiter")
                                : t("admin.roleUser")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${approvalBadgeClass[approval] || ""}`}>
                            {approval}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(u.signup_requested_at || u.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.experience_years != null ? `${u.experience_years} yr${u.experience_years !== 1 ? "s" : ""}` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-[200px]">
                            {(u.skills || []).slice(0, 3).map((s: string) => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                            {(u.skills || []).length > 3 && <Badge variant="outline" className="text-xs">+{u.skills.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-[180px]">
                            {(u.desired_roles || []).slice(0, 2).map((r: string) => (
                              <Badge key={r} variant="outline" className="text-xs bg-primary/5">{r}</Badge>
                            ))}
                            {(u.desired_roles || []).length > 2 && <Badge variant="outline" className="text-xs">+{u.desired_roles.length - 2}</Badge>}
                            {!(u.desired_roles || []).length && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              {u.resume_url ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>{u.resume_url ? "Resume uploaded" : "No resume"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              {u.bio ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">{u.bio ? u.bio.substring(0, 120) + (u.bio.length > 120 ? "..." : "") : "No bio"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={completeness} className="h-2 flex-1" />
                            <span className={`text-xs font-medium ${completeness >= 80 ? "text-emerald-500" : completeness >= 50 ? "text-amber-500" : "text-destructive"}`}>
                              {completeness}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            <Briefcase className="h-3 w-3 me-1" />
                            {u._appCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(u.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center gap-1 justify-end">
                            {!isCurrentUser && approval === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
                                  disabled={approving === u.user_id}
                                  onClick={() => setApproval(u.user_id, "approved")}
                                  title="Approve"
                                >
                                  {approving === u.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  disabled={approving === u.user_id}
                                  onClick={() => setApproval(u.user_id, "rejected")}
                                  title="Reject"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isCurrentUser && (
                              <>
                                <Button
                                  size="sm"
                                  variant={isAdmin ? "destructive" : "default"}
                                  className={!isAdmin ? "gradient-primary border-0" : ""}
                                  disabled={updating === u.user_id}
                                  onClick={() => toggleRole(u.user_id, u._role)}
                                >
                                  {updating === u.user_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />
                                  ) : isAdmin ? (
                                    <ShieldOff className="h-3.5 w-3.5 me-1" />
                                  ) : (
                                    <ShieldCheck className="h-3.5 w-3.5 me-1" />
                                  )}
                                  {isAdmin ? t("admin.demote") : t("admin.promote")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
                                  onClick={() => openDelete(u)}
                                  title={t("admin.deletePermanently")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t("admin.editUser", { name: editUser?.full_name || t("admin.userFallback") })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.fullName")}</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.colEmail")}</Label>
                <Input type="email" dir="ltr" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.colPhone")}</Label>
                <Input dir="ltr" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder={t("admin.phonePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.experienceYears")}</Label>
                <Input type="number" min="0" value={editForm.experience_years} onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.linkedinUrl")}</Label>
              <Input dir="ltr" value={editForm.linkedin_url} onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })} placeholder={t("admin.linkedinPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.githubUrl")}</Label>
              <Input dir="ltr" value={editForm.github_url} onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })} placeholder={t("admin.githubPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.skillsComma")}</Label>
              <Input value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.desiredRolesComma")}</Label>
              <Input value={editForm.desired_roles} onChange={(e) => setEditForm({ ...editForm, desired_roles: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.bio")}</Label>
              <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder={t("admin.bioPlaceholder")} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("admin.cancel")}</Button>
            <Button className="gradient-primary border-0" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t("admin.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-rose-300">
              {t("admin.deleteUserTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              <MixedDir>
                {t("admin.deleteUserDesc", {
                  name: deleteTarget?.full_name || deleteTarget?.email || t("admin.thisUser"),
                })}
              </MixedDir>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="delete-confirm">
              <MixedDir>
                {t("admin.deleteConfirmHint", {
                  email: deleteTarget?.email || t("admin.theUserEmail"),
                  phrase: t("admin.deleteConfirmPhrase"),
                })}
              </MixedDir>
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={t("admin.confirmationPlaceholder")}
              autoComplete="off"
              dir="ltr"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("admin.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmValid || deleting}
              onClick={handleDelete}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Trash2 className="h-4 w-4 me-1" />}
              {t("admin.deletePermanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
