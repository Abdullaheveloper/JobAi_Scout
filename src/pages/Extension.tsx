import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Chrome, CheckCircle2, AlertTriangle, Server, Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function Extension() {
  const { user } = useAuth();

  const handleDownload = () => {
    fetch("/jobai-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "jobai-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Extension downloaded — see install steps below");
      })
      .catch((err) => toast.error(err.message));
  };

  const steps = [
    "Unzip the downloaded jobai-extension.zip file",
    "Open chrome://extensions in Chrome (or any Chromium browser)",
    "Turn on Developer mode (toggle in top-right)",
    "Click 'Load unpacked' and select the unzipped folder",
    `Click the JobAI icon, then sign in with Google or with your email${user?.email ? ` (${user.email})` : ""} and password`,
    "Open any job application page (Indeed, LinkedIn, Greenhouse, Lever, Workday, or most other ATS) and click 'Verify & fill this page'",
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Job Form Fill</h1>
          <p className="text-muted-foreground mt-2">
            Auto-fill job applications with your JobAI profile in one click.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Chrome className="w-5 h-5 text-primary" /> Download
            </CardTitle>
            <CardDescription>
              Works in Chrome, Edge, Brave, Arc, and Opera.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" /> Download Extension (.zip)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Install in 6 steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What gets filled</CardTitle>
            <CardDescription>
              25+ regex patterns match every common variant — <code>first_name</code>,
              <code> firstname</code>, <code> fname</code>, <code> given_name</code>, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              "Full name (first / last / full)",
              "Email address",
              "Phone number",
              "Location / city",
              "LinkedIn URL",
              "GitHub URL",
              "Skills (comma-separated)",
              "CV summary (in cover-letter / about textareas)",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {f}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported sites</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Indeed, LinkedIn, Greenhouse, Lever, and Workday out of the box. The
            content script also reads each field's <code>name</code>, <code>id</code>,
            <code> placeholder</code>, <code>aria-label</code>, nearby{" "}
            <code>&lt;label&gt;</code> text and <code>data-testid</code> — so it
            works on most unknown ATS forms without any site-specific config.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" /> Missing fields
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            If your profile is missing a field the form needs, a yellow warning
            appears inside the extension popup listing exactly which fields are
            empty — so you know what to add to your JobAI profile.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> Developer setup (optional)
            </CardTitle>
            <CardDescription>
              Only needed if you're hosting your own backend instead of using
              JobAI Cloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Server className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">1. Deploy your backend</p>
                <p className="text-muted-foreground">
                  Open <code>backend-example/server.js</code>, replace the demo
                  section with your DB query (Supabase, MongoDB, or Prisma —
                  comments included for each), and deploy to Vercel, Railway, or
                  Render.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Settings2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">2. Set your API URL</p>
                <p className="text-muted-foreground">
                  Open <code>config.js</code> and update:
                </p>
                <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto">
{`API_BASE: "https://your-deployed-backend.com/api"`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
