import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, Loader2, Save } from "lucide-react";

export default function RecruiterProfile() {
  const { t } = useTranslation();
  const { user, recruiterProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ company_name: "", website: "", industry: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recruiterProfile) {
      setForm({
        company_name: recruiterProfile.company_name || "",
        website: recruiterProfile.website || "",
        industry: recruiterProfile.industry || "",
        description: recruiterProfile.description || "",
      });
    }
  }, [recruiterProfile]);

  const save = async () => {
    if (!user || !form.company_name.trim()) {
      return toast({ title: t("recruiter.toastRequired"), variant: "destructive" });
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      company_name: form.company_name.trim(),
      website: form.website.trim() || null,
      industry: form.industry.trim() || null,
      description: form.description.trim() || null,
    };
    const { error } = await supabase.from("recruiter_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      return toast({ title: t("recruiter.toastSaveFailed"), description: error.message, variant: "destructive" });
    }
    toast({ title: t("recruiter.toastSavedTitle"), description: t("recruiter.toastSavedBody") });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{t("recruiter.workspace")}</p>
          <h1 className="mt-2 font-display text-3xl font-bold">{t("recruiter.companyProfile")}</h1>
          <p className="mt-1 text-muted-foreground">{t("recruiter.companyProfileCopy")}</p>
        </section>
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {t("recruiter.companyDetails")}
            </CardTitle>
            <CardDescription>{t("recruiter.companyDetailsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("recruiter.companyName")}</Label>
              <Input
                value={form.company_name}
                onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
                placeholder={t("recruiter.companyPlaceholder")}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("recruiter.website")}</Label>
                <div className="relative">
                  <Globe className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="ps-9"
                    type="url"
                    dir="ltr"
                    value={form.website}
                    onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                    placeholder={t("recruiter.websitePlaceholder")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("recruiter.industry")}</Label>
                <Input
                  value={form.industry}
                  onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))}
                  placeholder={t("recruiter.industryPlaceholder")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("recruiter.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t("recruiter.profileDescriptionPlaceholder")}
                rows={5}
              />
            </div>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
              {saving ? t("common.loading") : t("recruiter.saveProfile")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
