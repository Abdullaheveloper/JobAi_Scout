import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileUp, Briefcase, Bookmark, Sparkles, TrendingUp, Target } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  const { profile } = useAuth();
  const skills = profile?.skills || [];
  const desiredRoles = profile?.desired_roles || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome back, {profile?.full_name || "there"}! 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Here's your job search overview</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skills Detected</CardTitle>
              <Sparkles className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{skills.length}</div>
              <p className="text-xs text-muted-foreground mt-1">from your CV analysis</p>
            </CardContent>
          </Card>
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suggested Roles</CardTitle>
              <Target className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{desiredRoles.length}</div>
              <p className="text-xs text-muted-foreground mt-1">AI-recommended positions</p>
            </CardContent>
          </Card>
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profile Status</CardTitle>
              <TrendingUp className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{skills.length > 0 ? "Active" : "Setup"}</div>
              <p className="text-xs text-muted-foreground mt-1">{skills.length > 0 ? "Ready for matching" : "Upload your CV to start"}</p>
            </CardContent>
          </Card>
        </div>

        {skills.length === 0 ? (
          <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileUp className="h-12 w-12 text-primary mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Upload Your CV</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Upload your resume and our AI will extract your skills, suggest job roles, and find matching opportunities.
              </p>
              <Button asChild>
                <Link to="/dashboard/cv">Upload CV Now</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Sparkles className="h-5 w-5 text-primary" /> Your Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary border-0">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Target className="h-5 w-5 text-accent" /> Suggested Roles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {desiredRoles.map((role: string) => (
                    <Badge key={role} variant="secondary" className="bg-accent/10 text-accent border-0">
                      {role}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" className="mt-4 w-full" asChild>
                  <Link to="/dashboard/jobs">
                    <Briefcase className="mr-2 h-4 w-4" /> Browse Matching Jobs
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
