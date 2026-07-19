import { useMemo, useState } from "react";
import {
  Award, BookOpenText, BriefcaseBusiness, CalendarDays, FolderKanban,
  Globe2, GraduationCap, MapPin, Pencil, Plus, ShieldCheck, Trash2, UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CareerAchievement, CareerEducation, CareerExperience, CareerProfile, CareerProject,
  CareerReference, createCareerId,
} from "@/lib/career-profile";

type EditorKind = "experience" | "education" | "project" | "achievement" | "reference";
type Draft = Record<string, string | boolean>;

type EditorState = {
  kind: EditorKind;
  index: number | null;
  draft: Draft;
};

type Props = {
  value: CareerProfile;
  onChange: (next: CareerProfile) => void;
};

const csv = (value: string) => value.split(/,|\n/).map((item) => item.trim()).filter(Boolean);
const text = (value: unknown) => typeof value === "string" ? value : "";

const emptyDraft = (kind: EditorKind): Draft => {
  const id = createCareerId();
  switch (kind) {
    case "experience": return { id, company: "", title: "", location: "", employmentType: "", startDate: "", endDate: "", isCurrent: false, summary: "", highlights: "", skills: "" };
    case "education": return { id, institution: "", degree: "", fieldOfStudy: "", location: "", startDate: "", endDate: "", grade: "", activities: "" };
    case "project": return { id, name: "", role: "", url: "", startDate: "", endDate: "", description: "", highlights: "", skills: "" };
    case "achievement": return { id, type: "certification", title: "", issuer: "", date: "", url: "", description: "" };
    case "reference": return { id, fullName: "", relationship: "", company: "", email: "", phone: "", permissionToContact: false };
  }
};

function toDraft(kind: EditorKind, item: CareerExperience | CareerEducation | CareerProject | CareerAchievement | CareerReference): Draft {
  if (kind === "experience") {
    const value = item as CareerExperience;
    return { ...value, highlights: value.highlights.join("\n"), skills: value.skills.join(", ") };
  }
  if (kind === "project") {
    const value = item as CareerProject;
    return { ...value, highlights: value.highlights.join("\n"), skills: value.skills.join(", ") };
  }
  return { ...item } as unknown as Draft;
}

function toExperience(draft: Draft): CareerExperience {
  return {
    id: text(draft.id) || createCareerId(), company: text(draft.company), title: text(draft.title),
    location: text(draft.location), employmentType: text(draft.employmentType), startDate: text(draft.startDate),
    endDate: text(draft.endDate), isCurrent: Boolean(draft.isCurrent), summary: text(draft.summary),
    highlights: csv(text(draft.highlights)), skills: csv(text(draft.skills)),
  };
}

function toEducation(draft: Draft): CareerEducation {
  return {
    id: text(draft.id) || createCareerId(), institution: text(draft.institution), degree: text(draft.degree),
    fieldOfStudy: text(draft.fieldOfStudy), location: text(draft.location), startDate: text(draft.startDate),
    endDate: text(draft.endDate), grade: text(draft.grade), activities: text(draft.activities),
  };
}

function toProject(draft: Draft): CareerProject {
  return {
    id: text(draft.id) || createCareerId(), name: text(draft.name), role: text(draft.role), url: text(draft.url),
    startDate: text(draft.startDate), endDate: text(draft.endDate), description: text(draft.description),
    highlights: csv(text(draft.highlights)), skills: csv(text(draft.skills)),
  };
}

function toAchievement(draft: Draft): CareerAchievement {
  const type = text(draft.type);
  return {
    id: text(draft.id) || createCareerId(), type: type === "award" || type === "publication" ? type : "certification",
    title: text(draft.title), issuer: text(draft.issuer), date: text(draft.date), url: text(draft.url), description: text(draft.description),
  };
}

function toReference(draft: Draft): CareerReference {
  return {
    id: text(draft.id) || createCareerId(), fullName: text(draft.fullName), relationship: text(draft.relationship),
    company: text(draft.company), email: text(draft.email), phone: text(draft.phone), permissionToContact: Boolean(draft.permissionToContact),
  };
}

function dates(start: string, end: string, current = false) {
  if (!start && !end && !current) return "Dates not added";
  return `${start || "Start date"} – ${current ? "Present" : end || "End date"}`;
}

function EmptySection({ title, description, onAdd, label }: { title: string; description: string; onAdd: () => void; label: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/15 px-4 text-center">
    <p className="font-medium text-foreground">No {title.toLowerCase()} yet</p>
    <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    <Button type="button" size="sm" variant="outline" className="mt-4 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> {label}</Button>
  </div>;
}

function CareerHeader({ icon: Icon, title, description, count, onAdd, label }: { icon: typeof BriefcaseBusiness; title: string; description: string; count: number; onAdd: () => void; label: string }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h3 className="font-display text-lg font-semibold">{title}</h3><Badge variant="outline" className="border-white/10 bg-white/5 text-xs">{count}</Badge></div><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div></div>
    <Button type="button" size="sm" className="gap-1.5 gradient-primary border-0" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> {label}</Button>
  </div>;
}

export default function CareerProfileWorkspace({ value, onChange }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const entryCount = useMemo(() => value.experiences.length + value.education.length + value.projects.length + value.achievements.length + value.references.length, [value]);

  const open = (kind: EditorKind, index: number | null = null) => {
    const list = kind === "experience" ? value.experiences : kind === "education" ? value.education : kind === "project" ? value.projects : kind === "achievement" ? value.achievements : value.references;
    setEditor({ kind, index, draft: index === null ? emptyDraft(kind) : toDraft(kind, list[index]) });
  };

  const remove = (kind: EditorKind, index: number) => {
    if (!window.confirm("Remove this entry? It will be removed when you save your profile.")) return;
    const next = { ...value };
    if (kind === "experience") next.experiences = value.experiences.filter((_, itemIndex) => itemIndex !== index);
    if (kind === "education") next.education = value.education.filter((_, itemIndex) => itemIndex !== index);
    if (kind === "project") next.projects = value.projects.filter((_, itemIndex) => itemIndex !== index);
    if (kind === "achievement") next.achievements = value.achievements.filter((_, itemIndex) => itemIndex !== index);
    if (kind === "reference") next.references = value.references.filter((_, itemIndex) => itemIndex !== index);
    onChange(next);
  };

  const saveEditor = () => {
    if (!editor) return;
    const { kind, index, draft } = editor;
    const next = { ...value };
    const replace = <T,>(items: T[], entry: T) => index === null ? [...items, entry] : items.map((item, itemIndex) => itemIndex === index ? entry : item);
    if (kind === "experience") next.experiences = replace(value.experiences, toExperience(draft));
    if (kind === "education") next.education = replace(value.education, toEducation(draft));
    if (kind === "project") next.projects = replace(value.projects, toProject(draft));
    if (kind === "achievement") next.achievements = replace(value.achievements, toAchievement(draft));
    if (kind === "reference") next.references = replace(value.references, toReference(draft));
    onChange(next);
    setEditor(null);
  };

  const update = (key: string, entry: string | boolean) => setEditor((current) => current ? { ...current, draft: { ...current.draft, [key]: entry } } : current);
  const field = (key: string, label: string, placeholder = "", type = "text") => <div className="space-y-1.5"><Label htmlFor={`career-${key}`}>{label}</Label><Input id={`career-${key}`} type={type} value={text(editor?.draft[key])} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="border-white/10 bg-black/20" /></div>;
  const textarea = (key: string, label: string, placeholder = "", hint?: string) => <div className="space-y-1.5"><Label htmlFor={`career-${key}`}>{label}</Label><Textarea id={`career-${key}`} value={text(editor?.draft[key])} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} rows={3} className="border-white/10 bg-black/20 leading-6" />{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;

  return <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-card">
    <CardHeader className="border-b border-white/[0.06] bg-black/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 font-display"><BriefcaseBusiness className="h-5 w-5 text-primary" /> Career passport</CardTitle><CardDescription className="mt-1">Structured, reusable facts for high-quality application forms. Nothing here is invented by AI.</CardDescription></div><Badge className="w-fit border border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">{entryCount} verified entries</Badge></div>
    </CardHeader>
    <CardContent className="space-y-7 p-5 sm:p-6">
      <section>
        <CareerHeader icon={BriefcaseBusiness} title="Work experience" description="Add each role once. The extension can map them to repeatable ATS work-history sections." count={value.experiences.length} label="Add role" onAdd={() => open("experience")} />
        {value.experiences.length ? <div className="space-y-3">{value.experiences.map((entry, index) => <div key={entry.id} className="group rounded-xl border border-white/[0.08] bg-black/15 p-4 transition-colors hover:border-primary/30"><div className="flex gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{entry.title || "Untitled role"}</p><p className="text-sm text-muted-foreground">{entry.company || "Company not added"}{entry.location ? ` · ${entry.location}` : ""}</p></div><EntryActions onEdit={() => open("experience", index)} onDelete={() => remove("experience", index)} /></div><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{dates(entry.startDate, entry.endDate, entry.isCurrent)}</p>{entry.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.summary}</p>}{entry.skills.length > 0 && <Chips values={entry.skills} />}</div></div></div>)}</div> : <EmptySection title="work experience" description="Your verified work history helps the extension complete repeated employer and role sections accurately." label="Add first role" onAdd={() => open("experience")} />}
      </section>

      <section className="border-t border-white/[0.06] pt-7">
        <CareerHeader icon={GraduationCap} title="Education" description="Keep degrees, institutions and dates structured instead of putting everything in one line." count={value.education.length} label="Add education" onAdd={() => open("education")} />
        {value.education.length ? <div className="grid gap-3 md:grid-cols-2">{value.education.map((entry, index) => <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-black/15 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{entry.degree || "Degree not added"}</p><p className="mt-0.5 text-sm text-muted-foreground">{entry.institution || "Institution not added"}</p></div><EntryActions onEdit={() => open("education", index)} onDelete={() => remove("education", index)} /></div>{entry.fieldOfStudy && <p className="mt-2 text-sm text-muted-foreground">{entry.fieldOfStudy}</p>}<p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{dates(entry.startDate, entry.endDate)}</p></div>)}</div> : <EmptySection title="education entries" description="Add each degree separately so applications with multiple education blocks can be completed correctly." label="Add education" onAdd={() => open("education")} />}
      </section>

      <section className="border-t border-white/[0.06] pt-7">
        <CareerHeader icon={FolderKanban} title="Projects" description="Show real work, outcomes and the tools you used. The AI selects relevant facts; it does not create new claims." count={value.projects.length} label="Add project" onAdd={() => open("project")} />
        {value.projects.length ? <div className="grid gap-3 md:grid-cols-2">{value.projects.map((entry, index) => <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-black/15 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{entry.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{entry.role || "Project role not added"}</p></div><EntryActions onEdit={() => open("project", index)} onDelete={() => remove("project", index)} /></div>{entry.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{entry.description}</p>}{entry.url && <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={entry.url} target="_blank" rel="noreferrer"><Globe2 className="h-3 w-3" /> View project</a>}{entry.skills.length > 0 && <Chips values={entry.skills} />}</div>)}</div> : <EmptySection title="projects" description="Add portfolio projects that are safe to mention in applications and cover letters." label="Add project" onAdd={() => open("project")} />}
      </section>

      <div className="grid gap-7 border-t border-white/[0.06] pt-7 lg:grid-cols-2">
        <section>
          <CareerHeader icon={Award} title="Credentials & recognition" description="Certifications, awards and publications." count={value.achievements.length} label="Add item" onAdd={() => open("achievement")} />
          {value.achievements.length ? <div className="space-y-3">{value.achievements.map((entry, index) => <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-black/15 p-3.5"><div className="flex justify-between gap-3"><div><Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] uppercase tracking-wide text-primary">{entry.type}</Badge><p className="mt-2 font-medium">{entry.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{entry.issuer || "Issuer not added"}</p></div><EntryActions onEdit={() => open("achievement", index)} onDelete={() => remove("achievement", index)} /></div></div>)}</div> : <EmptySection title="credentials" description="Add achievements that you are comfortable sharing with employers." label="Add item" onAdd={() => open("achievement")} />}
        </section>
        <section>
          <CareerHeader icon={UsersRound} title="References" description="Private by default. They are never filled without permission." count={value.references.length} label="Add reference" onAdd={() => open("reference")} />
          {value.references.length ? <div className="space-y-3">{value.references.map((entry, index) => <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-black/15 p-3.5"><div className="flex justify-between gap-3"><div><p className="font-medium">{entry.fullName}</p><p className="mt-0.5 text-sm text-muted-foreground">{[entry.relationship, entry.company].filter(Boolean).join(" · ") || "Relationship not added"}</p>{entry.permissionToContact ? <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" /> Permission confirmed</p> : <p className="mt-2 text-xs text-amber-300">Not eligible for auto-fill</p>}</div><EntryActions onEdit={() => open("reference", index)} onDelete={() => remove("reference", index)} /></div></div>)}</div> : <EmptySection title="references" description="Only add a reference after you have permission to share their contact details." label="Add reference" onAdd={() => open("reference")} />}
        </section>
      </div>
    </CardContent>

    <Dialog open={Boolean(editor)} onOpenChange={(openState) => { if (!openState) setEditor(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-primary/20 bg-[#0b1028] p-5 text-foreground sm:p-6">
        <DialogHeader><DialogTitle className="font-display text-xl">{editor?.index === null ? "Add" : "Edit"} {editor?.kind === "experience" ? "work experience" : editor?.kind === "education" ? "education" : editor?.kind === "project" ? "project" : editor?.kind === "achievement" ? "credential or recognition" : "reference"}</DialogTitle><DialogDescription>Enter only information you can honestly use in an application. You can edit it any time before saving.</DialogDescription></DialogHeader>
        {editor?.kind === "experience" && <div className="grid gap-4 sm:grid-cols-2">{field("title", "Job title", "Frontend Developer")}{field("company", "Company", "Company name")}{field("location", "Location", "City, Country")}{field("employmentType", "Employment type", "Full-time, contract…")} {field("startDate", "Start date", "", "month")} {editor.draft.isCurrent ? <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">Current role — no end date needed.</div> : field("endDate", "End date", "", "month")}<label className="col-span-full flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(editor.draft.isCurrent)} onChange={(event) => update("isCurrent", event.target.checked)} /> I currently work here</label><div className="col-span-full">{textarea("summary", "Role summary", "Describe your responsibilities and impact.")}</div><div className="col-span-full">{textarea("highlights", "Highlights", "One achievement per line", "Use real outcomes only.")}</div><div className="col-span-full">{textarea("skills", "Skills used", "React, TypeScript, …", "Separate skills with commas.")}</div></div>}
        {editor?.kind === "education" && <div className="grid gap-4 sm:grid-cols-2">{field("institution", "Institution", "University name")}{field("degree", "Degree", "BSc, MSc, Diploma…")}{field("fieldOfStudy", "Field of study", "Computer Science")}{field("location", "Location", "City, Country")}{field("startDate", "Start date", "", "month")}{field("endDate", "End date", "", "month")}{field("grade", "Grade / GPA", "Optional")}<div className="col-span-full">{textarea("activities", "Activities or details", "Optional societies, thesis or honours")}</div></div>}
        {editor?.kind === "project" && <div className="grid gap-4 sm:grid-cols-2">{field("name", "Project name", "Project name")}{field("role", "Your role", "Lead developer")}{field("url", "Project URL", "https://…", "url")}{field("startDate", "Start date", "", "month")}{field("endDate", "End date", "", "month")}<div className="col-span-full">{textarea("description", "Project description", "What did you build and why?")}</div><div className="col-span-full">{textarea("highlights", "Highlights", "One achievement per line")}</div><div className="col-span-full">{textarea("skills", "Tools and skills", "React, Node.js…", "Separate skills with commas.")}</div></div>}
        {editor?.kind === "achievement" && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="career-type">Type</Label><select id="career-type" value={text(editor.draft.type)} onChange={(event) => update("type", event.target.value)} className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm"><option value="certification">Certification</option><option value="award">Award</option><option value="publication">Publication</option></select></div>{field("title", "Title", "Certification, award or publication")}{field("issuer", "Issuer / publisher", "Organization")}{field("date", "Date", "", "month")}{field("url", "Credential URL", "https://…", "url")}<div className="col-span-full">{textarea("description", "Details", "Optional context")}</div></div>}
        {editor?.kind === "reference" && <div className="grid gap-4 sm:grid-cols-2">{field("fullName", "Full name", "Reference name")}{field("relationship", "Relationship", "Former manager")}{field("company", "Company", "Organization")}{field("email", "Email", "name@example.com", "email")}{field("phone", "Phone", "+92 …", "tel")}<label className="col-span-full flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(editor.draft.permissionToContact)} onChange={(event) => update("permissionToContact", event.target.checked)} /> This person has given permission to be contacted</label></div>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button><Button type="button" className="gradient-primary border-0" onClick={saveEditor}>Save entry</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

function Chips({ values }: { values: string[] }) {
  return <div className="mt-3 flex flex-wrap gap-1.5">{values.slice(0, 6).map((value) => <Badge key={value} variant="secondary" className="bg-white/[0.06] text-xs font-normal">{value}</Badge>)}</div>;
}

function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Edit entry" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove entry" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button></div>;
}
