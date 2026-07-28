import { useMemo, useState } from "react";
import {
  Award, BriefcaseBusiness, CalendarDays, FolderKanban,
  Globe2, GraduationCap, Pencil, Plus, ShieldCheck, Trash2, UsersRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CAREER_EDITOR_FIELDS,
  careerEditorKindLabelKey,
  careerEditorTitleKey,
  type CareerEditorKind,
  type CareerFieldDef,
} from "@/lib/career-passport-fields";
import {
  CareerAchievement, CareerEducation, CareerExperience, CareerProfile, CareerProject,
  CareerReference, createCareerId,
} from "@/lib/career-profile";

type Draft = Record<string, string | boolean>;

type EditorState = {
  kind: CareerEditorKind;
  index: number | null;
  draft: Draft;
};

type Props = {
  value: CareerProfile;
  onChange: (next: CareerProfile) => void;
};

const csv = (value: string) => value.split(/,|\n/).map((item) => item.trim()).filter(Boolean);
const text = (value: unknown) => typeof value === "string" ? value : "";

const emptyDraft = (kind: CareerEditorKind): Draft => {
  const id = createCareerId();
  switch (kind) {
    case "experience": return { id, company: "", title: "", location: "", employmentType: "", startDate: "", endDate: "", isCurrent: false, summary: "", highlights: "", skills: "" };
    case "education": return { id, institution: "", degree: "", fieldOfStudy: "", location: "", startDate: "", endDate: "", grade: "", activities: "", status: "", source: "user" };
    case "project": return { id, name: "", role: "", url: "", startDate: "", endDate: "", description: "", highlights: "", skills: "" };
    case "achievement": return { id, type: "certification", title: "", issuer: "", date: "", url: "", description: "", source: "user" };
    case "reference": return { id, fullName: "", relationship: "", company: "", email: "", phone: "", permissionToContact: false };
  }
};

function toDraft(kind: CareerEditorKind, item: CareerExperience | CareerEducation | CareerProject | CareerAchievement | CareerReference): Draft {
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
  const statusRaw = text(draft.status);
  const status = statusRaw === "Completed" || statusRaw === "Ongoing" ? statusRaw : "";
  return {
    id: text(draft.id) || createCareerId(), institution: text(draft.institution), degree: text(draft.degree),
    fieldOfStudy: text(draft.fieldOfStudy), location: text(draft.location), startDate: text(draft.startDate),
    endDate: text(draft.endDate), grade: text(draft.grade), activities: text(draft.activities),
    status,
    source: text(draft.source) || "user",
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
    source: text(draft.source) || "user",
  };
}

function toReference(draft: Draft): CareerReference {
  return {
    id: text(draft.id) || createCareerId(), fullName: text(draft.fullName), relationship: text(draft.relationship),
    company: text(draft.company), email: text(draft.email), phone: text(draft.phone), permissionToContact: Boolean(draft.permissionToContact),
  };
}

function formatDates(
  start: string,
  end: string,
  current: boolean,
  t: (key: string) => string,
) {
  if (!start && !end && !current) return t("careerPassport.datesNotAdded");
  return `${start || t("careerPassport.startDateFallback")} – ${current ? t("careerPassport.present") : end || t("careerPassport.endDateFallback")}`;
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "Completed") return t("careerPassport.status.completed");
  if (status === "Ongoing") return t("careerPassport.status.ongoing");
  return status;
}

function EmptySection({ title, description, onAdd, label }: { title: string; description: string; onAdd: () => void; label: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-4 text-center">
    <p className="font-medium text-foreground">{title}</p>
    <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    <Button type="button" size="sm" variant="outline" className="mt-4 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> {label}</Button>
  </div>;
}

function CareerHeader({ icon: Icon, title, description, count, onAdd, label }: { icon: typeof BriefcaseBusiness; title: string; description: string; count: number; onAdd: () => void; label: string }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h3 className="font-display text-lg font-semibold">{title}</h3><Badge variant="outline" className="border-border bg-muted text-xs">{count}</Badge></div><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div></div>
    <Button type="button" size="sm" className="gap-1.5 gradient-primary border-0" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> {label}</Button>
  </div>;
}

export default function CareerProfileWorkspace({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const entryCount = useMemo(() => value.experiences.length + value.education.length + value.projects.length + value.achievements.length + value.references.length, [value]);

  const open = (kind: CareerEditorKind, index: number | null = null) => {
    const list = kind === "experience" ? value.experiences : kind === "education" ? value.education : kind === "project" ? value.projects : kind === "achievement" ? value.achievements : value.references;
    setEditor({ kind, index, draft: index === null ? emptyDraft(kind) : toDraft(kind, list[index]) });
  };

  const remove = (kind: CareerEditorKind, index: number) => {
    if (!window.confirm(t("careerPassport.removeConfirm"))) return;
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

  const renderField = (def: CareerFieldDef) => {
    if (!editor) return null;
    const kind = def.kind || "input";
    const label = t(def.labelKey);
    const placeholder = def.placeholderKey ? t(def.placeholderKey) : "";
    const hint = def.hintKey ? t(def.hintKey) : undefined;
    const span = def.colSpan === "full" ? "col-span-full" : "";

    if (kind === "checkbox") {
      const checkboxClass = def.key === "permissionToContact"
        ? "col-span-full flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-sm"
        : "col-span-full flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm";
      return (
        <label key={def.key} className={checkboxClass}>
          <input type="checkbox" checked={Boolean(editor.draft[def.key])} onChange={(event) => update(def.key, event.target.checked)} />
          {label}
        </label>
      );
    }

    if (kind === "currentEndDate") {
      if (editor.draft.isCurrent) {
        return <div key={def.key} className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{t("careerPassport.currentRoleNoEnd")}</div>;
      }
      return (
        <div key={def.key} className={`space-y-1.5 ${span}`}>
          <Label htmlFor={`career-${def.key}`}>{label}</Label>
          <Input id={`career-${def.key}`} type={def.type || "text"} value={text(editor.draft[def.key])} onChange={(event) => update(def.key, event.target.value)} placeholder={placeholder} className="border-border bg-muted" />
        </div>
      );
    }

    if (kind === "select") {
      return (
        <div key={def.key} className={`space-y-1.5 ${span}`}>
          <Label htmlFor={`career-${def.key}`}>{label}</Label>
          <select
            id={`career-${def.key}`}
            value={text(editor.draft[def.key])}
            onChange={(event) => update(def.key, event.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-muted px-3 text-sm"
          >
            {(def.options || []).map((option) => (
              <option key={option.value || "__empty"} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </div>
      );
    }

    if (kind === "textarea") {
      return (
        <div key={def.key} className={`space-y-1.5 ${span}`}>
          <Label htmlFor={`career-${def.key}`}>{label}</Label>
          <Textarea id={`career-${def.key}`} value={text(editor.draft[def.key])} onChange={(event) => update(def.key, event.target.value)} placeholder={placeholder} rows={3} className="border-border bg-muted leading-6" />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      );
    }

    return (
      <div key={def.key} className={`space-y-1.5 ${span}`}>
        <Label htmlFor={`career-${def.key}`}>{label}</Label>
        <Input id={`career-${def.key}`} type={def.type || "text"} value={text(editor.draft[def.key])} onChange={(event) => update(def.key, event.target.value)} placeholder={placeholder} className="border-border bg-muted" />
      </div>
    );
  };

  const dialogKind = editor?.kind;
  const dialogTitle = dialogKind
    ? t(careerEditorTitleKey(dialogKind, editor.index === null), { kind: t(careerEditorKindLabelKey(dialogKind)) })
    : "";

  return <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-card">
    <CardHeader className="border-b border-border bg-muted/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display">
            <BriefcaseBusiness className="h-5 w-5 text-primary" /> {t("careerPassport.title")}
          </CardTitle>
          <CardDescription className="mt-1">{t("careerPassport.subtitle")}</CardDescription>
        </div>
        <Badge className="w-fit border border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">
          {t("careerPassport.verifiedEntries", { count: entryCount })}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-7 p-5 sm:p-6">
      <section>
        <CareerHeader
          icon={BriefcaseBusiness}
          title={t("careerPassport.workExperience")}
          description={t("careerPassport.workExperienceDesc")}
          count={value.experiences.length}
          label={t("careerPassport.addRole")}
          onAdd={() => open("experience")}
        />
        {value.experiences.length ? (
          <div className="space-y-3">
            {value.experiences.map((entry, index) => (
              <div key={entry.id} className="group rounded-xl border border-border bg-muted/50 p-4 transition-colors hover:border-primary/30">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{entry.title || t("careerPassport.untitledRole")}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.company || t("careerPassport.companyNotAdded")}
                          {entry.location ? ` · ${entry.location}` : ""}
                        </p>
                      </div>
                      <EntryActions onEdit={() => open("experience", index)} onDelete={() => remove("experience", index)} />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDates(entry.startDate, entry.endDate, entry.isCurrent, t)}
                    </p>
                    {entry.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.summary}</p>}
                    {entry.skills.length > 0 && <Chips values={entry.skills} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptySection
            title={t("careerPassport.emptyExperienceTitle")}
            description={t("careerPassport.emptyExperienceDesc")}
            label={t("careerPassport.addFirstRole")}
            onAdd={() => open("experience")}
          />
        )}
      </section>

      <section className="border-t border-border pt-7">
        <CareerHeader
          icon={GraduationCap}
          title={t("careerPassport.education")}
          description={t("careerPassport.educationDesc")}
          count={value.education.length}
          label={t("careerPassport.addEducation")}
          onAdd={() => open("education")}
        />
        {value.education.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {value.education.map((entry, index) => (
              <div key={entry.id} className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.degree || t("careerPassport.degreeNotAdded")}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.institution || t("careerPassport.institutionNotAdded")}</p>
                  </div>
                  <EntryActions onEdit={() => open("education", index)} onDelete={() => remove("education", index)} />
                </div>
                {entry.fieldOfStudy && <p className="mt-2 text-sm text-muted-foreground">{entry.fieldOfStudy}</p>}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDates(entry.startDate, entry.endDate, false, t)}
                  {entry.status ? ` · ${statusLabel(entry.status, t)}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptySection
            title={t("careerPassport.emptyEducationTitle")}
            description={t("careerPassport.emptyEducationDesc")}
            label={t("careerPassport.addEducation")}
            onAdd={() => open("education")}
          />
        )}
      </section>

      <section className="border-t border-border pt-7">
        <CareerHeader
          icon={FolderKanban}
          title={t("careerPassport.projects")}
          description={t("careerPassport.projectsDesc")}
          count={value.projects.length}
          label={t("careerPassport.addProject")}
          onAdd={() => open("project")}
        />
        {value.projects.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {value.projects.map((entry, index) => (
              <div key={entry.id} className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.role || t("careerPassport.projectRoleNotAdded")}</p>
                  </div>
                  <EntryActions onEdit={() => open("project", index)} onDelete={() => remove("project", index)} />
                </div>
                {entry.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{entry.description}</p>}
                {entry.url && (
                  <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={entry.url} target="_blank" rel="noreferrer">
                    <Globe2 className="h-3 w-3" /> {t("careerPassport.viewProject")}
                  </a>
                )}
                {entry.skills.length > 0 && <Chips values={entry.skills} />}
              </div>
            ))}
          </div>
        ) : (
          <EmptySection
            title={t("careerPassport.emptyProjectsTitle")}
            description={t("careerPassport.emptyProjectsDesc")}
            label={t("careerPassport.addProject")}
            onAdd={() => open("project")}
          />
        )}
      </section>

      <div className="grid gap-7 border-t border-border pt-7 lg:grid-cols-2">
        <section>
          <CareerHeader
            icon={Award}
            title={t("careerPassport.credentialsRecognition")}
            description={t("careerPassport.credentialsRecognitionDesc")}
            count={value.achievements.length}
            label={t("careerPassport.addItem")}
            onAdd={() => open("achievement")}
          />
          {value.achievements.length ? (
            <div className="space-y-3">
              {value.achievements.map((entry, index) => (
                <div key={entry.id} className="rounded-xl border border-border bg-muted/50 p-3.5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-[10px] uppercase tracking-wide text-primary">
                        {t(`careerPassport.types.${entry.type}`)}
                      </Badge>
                      <p className="mt-2 font-medium">{entry.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{entry.issuer || t("careerPassport.issuerNotAdded")}</p>
                    </div>
                    <EntryActions onEdit={() => open("achievement", index)} onDelete={() => remove("achievement", index)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title={t("careerPassport.emptyCredentialsTitle")}
              description={t("careerPassport.emptyCredentialsDesc")}
              label={t("careerPassport.addItem")}
              onAdd={() => open("achievement")}
            />
          )}
        </section>
        <section>
          <CareerHeader
            icon={UsersRound}
            title={t("careerPassport.references")}
            description={t("careerPassport.referencesDesc")}
            count={value.references.length}
            label={t("careerPassport.addReference")}
            onAdd={() => open("reference")}
          />
          {value.references.length ? (
            <div className="space-y-3">
              {value.references.map((entry, index) => (
                <div key={entry.id} className="rounded-xl border border-border bg-muted/50 p-3.5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.fullName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[entry.relationship, entry.company].filter(Boolean).join(" · ") || t("careerPassport.relationshipNotAdded")}
                      </p>
                      {entry.permissionToContact ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" /> {t("careerPassport.permissionConfirmed")}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-300">{t("careerPassport.notEligibleAutofill")}</p>
                      )}
                    </div>
                    <EntryActions onEdit={() => open("reference", index)} onDelete={() => remove("reference", index)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptySection
              title={t("careerPassport.emptyReferencesTitle")}
              description={t("careerPassport.emptyReferencesDesc")}
              label={t("careerPassport.addReference")}
              onAdd={() => open("reference")}
            />
          )}
        </section>
      </div>
    </CardContent>

    <Dialog open={Boolean(editor)} onOpenChange={(openState) => { if (!openState) setEditor(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-primary/20 bg-background p-5 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{dialogTitle}</DialogTitle>
          <DialogDescription>{t("careerPassport.dialog.description")}</DialogDescription>
        </DialogHeader>
        {dialogKind && (
          <div className="grid gap-4 sm:grid-cols-2">
            {CAREER_EDITOR_FIELDS[dialogKind].map((field) => renderField(field))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditor(null)}>{t("common.cancel")}</Button>
          <Button type="button" className="gradient-primary border-0" onClick={saveEditor}>{t("careerPassport.saveEntry")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}

function Chips({ values }: { values: string[] }) {
  return <div className="mt-3 flex flex-wrap gap-1.5">{values.slice(0, 6).map((value) => <Badge key={value} variant="secondary" className="bg-white/[0.06] text-xs font-normal">{value}</Badge>)}</div>;
}

function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={t("careerPassport.editEntryAria")} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t("careerPassport.removeEntryAria")} onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
