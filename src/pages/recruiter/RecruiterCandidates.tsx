import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { StickyNote, Plus, Trash2 } from "lucide-react";

export default function RecruiterCandidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [newNote, setNewNote] = useState<Record<string, string>>({});
  const [notePrivacy, setNotePrivacy] = useState<Record<string, boolean>>({});
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Get all candidates who applied to recruiter's jobs
      const { data: jobs } = await supabase.from("jobs").select("id").eq("recruiter_id", user.id);
      const jobIds = (jobs || []).map(j => j.id);
      if (jobIds.length === 0) return;

      const { data: apps } = await supabase
        .from("job_applications")
        .select("user_id, profiles!inner(full_name, email, skills, experience_years)")
        .in("job_id", jobIds);

      // Deduplicate by user_id
      const uniqueCandidates = new Map();
      (apps || []).forEach(a => { if (!uniqueCandidates.has(a.user_id)) uniqueCandidates.set(a.user_id, a); });
      setCandidates(Array.from(uniqueCandidates.values()));

      // Fetch notes
      const { data: notesData } = await supabase.from("candidate_notes").select("*").eq("recruiter_id", user.id).order("created_at", { ascending: false });
      const grouped: Record<string, any[]> = {};
      (notesData || []).forEach(n => { if (!grouped[n.candidate_id]) grouped[n.candidate_id] = []; grouped[n.candidate_id].push(n); });
      setNotes(grouped);
    };
    fetch();
  }, [user]);

  const addNote = async (candidateId: string) => {
    if (!user || !newNote[candidateId]?.trim()) return;
    const { error } = await supabase.from("candidate_notes").insert({
      recruiter_id: user.id,
      candidate_id: candidateId,
      note_text: newNote[candidateId],
      is_private: notePrivacy[candidateId] ?? true,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Note added" });
      setNewNote({ ...newNote, [candidateId]: "" });
      // Refetch notes
      const { data } = await supabase.from("candidate_notes").select("*").eq("recruiter_id", user.id).eq("candidate_id", candidateId).order("created_at", { ascending: false });
      setNotes(prev => ({ ...prev, [candidateId]: data || [] }));
    }
  };

  const deleteNote = async (noteId: string, candidateId: string) => {
    await supabase.from("candidate_notes").delete().eq("id", noteId);
    setNotes(prev => ({ ...prev, [candidateId]: (prev[candidateId] || []).filter(n => n.id !== noteId) }));
    toast({ title: "Note deleted" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Candidates</h1>
          <p className="text-muted-foreground">View applicants and manage notes</p>
        </div>

        {candidates.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No candidates yet.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {candidates.map(c => (
              <Card key={c.user_id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedCandidate(expandedCandidate === c.user_id ? null : c.user_id)}>
                    <div>
                      <h3 className="font-semibold">{c.profiles?.full_name || "Unknown"}</h3>
                      <p className="text-sm text-muted-foreground">{c.profiles?.email}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(c.profiles?.skills || []).slice(0, 5).map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{(notes[c.user_id] || []).length} notes</span>
                    </div>
                  </div>

                  {expandedCandidate === c.user_id && (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {/* Existing notes */}
                      {(notes[c.user_id] || []).map(n => (
                        <div key={n.id} className="flex items-start justify-between bg-muted/50 rounded-lg p-3">
                          <div>
                            <p className="text-sm">{n.note_text}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant={n.is_private ? "outline" : "secondary"} className="text-xs">
                                {n.is_private ? "Private" : "Public"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(n.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteNote(n.id, c.user_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {/* Add note */}
                      <div className="space-y-2">
                        <Textarea
                          value={newNote[c.user_id] || ""}
                          onChange={(e) => setNewNote({ ...newNote, [c.user_id]: e.target.value })}
                          placeholder="Add a note about this candidate..."
                          rows={2}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={notePrivacy[c.user_id] ?? true}
                              onCheckedChange={(v) => setNotePrivacy({ ...notePrivacy, [c.user_id]: v })}
                            />
                            <Label className="text-xs">{(notePrivacy[c.user_id] ?? true) ? "Private" : "Public (visible to candidate)"}</Label>
                          </div>
                          <Button size="sm" onClick={() => addNote(c.user_id)}>
                            <Plus className="mr-1 h-3 w-3" /> Add Note
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
