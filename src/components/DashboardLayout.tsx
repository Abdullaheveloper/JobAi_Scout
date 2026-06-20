import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FileUp, Briefcase, Bookmark, BarChart3, Users, UserCog, LogOut,
  Shield, Mic, ClipboardList, Building2, StickyNote, Chrome,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VoiceWidget } from "@/components/VoiceWidget";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Upload CV", url: "/dashboard/cv", icon: FileUp },
  { title: "Browse Jobs", url: "/dashboard/jobs", icon: Briefcase },
  { title: "Saved Jobs", url: "/dashboard/saved", icon: Bookmark },
  { title: "Voice Assistant", url: "/dashboard/assistant", icon: Mic },
  { title: "Browser Extension", url: "/dashboard/extension", icon: Chrome },
  { title: "Profile Settings", url: "/dashboard/settings", icon: UserCog },
];

const recruiterNav = [
  { title: "My Jobs", url: "/recruiter/jobs", icon: Briefcase },
  { title: "Candidates", url: "/recruiter/candidates", icon: Users },
  { title: "Profile Settings", url: "/dashboard/settings", icon: UserCog },
];

const adminNav = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield },
  { title: "Manage Users", url: "/admin/users", icon: Users },
  { title: "Manage Jobs", url: "/admin/jobs", icon: Briefcase },
  { title: "Platform Analytics", url: "/admin/analytics", icon: BarChart3 },
];

function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  let navItems = userNav;
  if (role === "recruiter") navItems = recruiterNav;
  else if (role === "admin") navItems = [...userNav, ...adminNav];

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const homeUrl = role === "recruiter" ? "/recruiter/jobs" : role === "admin" ? "/dashboard" : "/dashboard";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-display text-lg font-bold text-sidebar-foreground">JobAI</span>}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>
            {role === "recruiter" ? "Recruiter" : role === "admin" ? "Navigation" : "Job Seeker"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title + item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard" || item.url === "/admin"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            )}
            {!collapsed && (
              <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate("/"); }} className="shrink-0">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <h2 className="font-display text-lg font-semibold text-foreground">AI Job Intelligence Platform</h2>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
          <VoiceWidget />
        </div>
      </div>
    </SidebarProvider>
  );
}
