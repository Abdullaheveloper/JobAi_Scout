import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Loader2, Briefcase, CheckCircle2, XCircle, Linkedin, Github, Pencil } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Edit dialog state
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

  useEffect(() => {
    fetchUsers();
  }, []);

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
      setUsers(profilesRes.data.map((p: any) => ({
        ...p,
        _role: roleMap.get(p.user_id) || "user",
        _appCount: appCountMap.get(p.user_id) || 0,
      })));
    }
    setLoading(false);
  };

  const toggleRole = async (targetUserId: string, currentRole: string) => {
    if (targetUserId === user?.id) {
      toast({ title: "Cannot change your own role", variant: "destructive" });
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
      toast({ title: `Role updated to ${newRole}` });
      await fetchUsers();
    } catch (err: any) {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(null);
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
      toast({ title: "Profile updated!" });
      setEditOpen(false);
      await fetchUsers();
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Manage Users</h1>
          <p className="text-muted-foreground mt-1">View and manage platform users</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Links</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Skills</TableHead>
                    <TableHead>Desired Roles</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead>Bio</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isCurrentUser = u.user_id === user?.id;
                    const isAdmin = u._role === "admin";
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
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell className="text-sm">{u.phone || <span className="text-muted-foreground">—</span>}</TableCell>
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
                            {u._role || "user"}
                          </Badge>
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
                            <Briefcase className="h-3 w-3 mr-1" />
                            {u._appCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(u.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(u)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isCurrentUser && (
                              <Button
                                size="sm"
                                variant={isAdmin ? "destructive" : "default"}
                                className={!isAdmin ? "gradient-primary border-0" : ""}
                                disabled={updating === u.user_id}
                                onClick={() => toggleRole(u.user_id, u._role)}
                              >
                                {updating === u.user_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                ) : isAdmin ? (
                                  <ShieldOff className="h-3.5 w-3.5 mr-1" />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                                )}
                                {isAdmin ? "Demote" : "Promote"}
                              </Button>
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

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Edit {editUser?.full_name || "User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1 234 567 890" />
              </div>
              <div className="space-y-2">
                <Label>Experience (years)</Label>
                <Input type="number" min="0" value={editForm.experience_years} onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={editForm.linkedin_url} onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="space-y-2">
              <Label>GitHub URL</Label>
              <Input value={editForm.github_url} onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })} placeholder="https://github.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Skills (comma-separated)</Label>
              <Input value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} placeholder="React, Node.js, TypeScript" />
            </div>
            <div className="space-y-2">
              <Label>Desired Roles (comma-separated)</Label>
              <Input value={editForm.desired_roles} onChange={(e) => setEditForm({ ...editForm, desired_roles: e.target.value })} placeholder="Full Stack Engineer, Frontend Developer" />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder="Brief professional summary..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="gradient-primary border-0" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
