import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FileUp, Briefcase, Bookmark, BarChart3, Users, UserCog, LogOut,
  Shield, Mic, ExternalLink, Zap, Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { JobAILogo } from "@/components/brand/JobAILogo";

const userNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Upload CV", url: "/dashboard/cv", icon: FileUp },
  { title: "Browse Jobs", url: "/dashboard/jobs", icon: Briefcase },
  { title: "Saved Jobs", url: "/dashboard/saved", icon: Bookmark },
  { title: "Form Fill", url: "/dashboard/auto-fill", icon: Zap },
  { title: "Voice Assistant", url: "/dashboard/assistant", icon: Mic },
  { title: "Profile Settings", url: "/dashboard/settings", icon: UserCog },
];

const recruiterNav = [
  { title: "Company Profile", url: "/recruiter/profile", icon: UserCog },
  { title: "Post a Job", url: "/recruiter/jobs?new=1", icon: Plus },
  { title: "My Jobs", url: "/recruiter/jobs", icon: Briefcase },
  { title: "Applicants", url: "/recruiter/candidates", icon: Users },
  { title: "Application Status", url: "/recruiter/application-status", icon: BarChart3 },
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
  else if (role === "admin") navItems = adminNav;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const roleLabel = role === "recruiter" ? "Recruiter" : role === "admin" ? "Admin" : "Job Seeker";
  const roleColor = role === "recruiter" ? "text-cyan-400" : role === "admin" ? "text-rose-400" : "text-indigo-400";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-indigo-500/10"
      style={{
        background: "linear-gradient(180deg, rgba(6,13,36,0.98) 0%, rgba(2,8,23,0.98) 100%)",
        backdropFilter: "blur(20px)",
      }}
    >
      <SidebarContent className="flex flex-col">
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-indigo-500/10 ${collapsed ? "justify-center" : ""}`}>
          <JobAILogo showWordmark={false} markClassName="h-9 w-9" />
          {!collapsed && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><JobAILogo markClassName="hidden" /></motion.div>}
        </div>

        {/* Role Badge */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-1">
            <span className={`text-xs font-semibold tracking-wider uppercase ${roleColor}`}>{roleLabel} Portal</span>
          </div>
        )}

        {/* Nav Items */}
        <SidebarGroup className="flex-1 px-2 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title + item.url}>
                  <SidebarMenuButton asChild className="h-10 rounded-xl">
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard" || item.url === "/admin"}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all duration-200 hover:bg-indigo-500/10 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-indigo-500/15 text-indigo-300 border-r-2 border-indigo-500 font-medium"
                    >
                      <item.icon className="h-4.5 w-4.5 h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Footer */}
        <div className="border-t border-indigo-500/10 p-3">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <Avatar className="h-8 w-8 ring-2 ring-indigo-500/30">
              <AvatarFallback
                className="text-xs font-semibold text-indigo-300"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.25) 100%)" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {profile?.full_name || "User"}
                </p>
                <p className="text-xs text-gray-600 truncate">{profile?.email}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => { signOut(); navigate("/"); }}
                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-gray-600 hover:text-rose-400 transition-all"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const workspaceTabs = role === "admin"
    ? [{ label: "Admin", url: "/admin", icon: Shield }]
    : role === "recruiter"
      ? [{ label: "Recruitment", url: "/recruiter/jobs", icon: Users }]
      : [];

  return (
    <SidebarProvider>
      <div
        className="min-h-screen flex w-full"
        style={{ background: "linear-gradient(135deg, #020817 0%, #060d24 50%, #020817 100%)" }}
      >
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header
            className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap"
            style={{
              background: "rgba(6, 13, 36, 0.9)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(99, 102, 241, 0.1)",
            }}
          >
            <SidebarTrigger className="text-gray-500 hover:text-white transition-colors" />
            <div className="h-4 w-px bg-indigo-500/20" />
            <h2
              className="hidden font-semibold text-white text-sm sm:block"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              AI Job Intelligence Platform
            </h2>
            {workspaceTabs.length > 0 && (
              <nav className="flex items-center rounded-lg border border-white/10 bg-black/15 p-1" aria-label="Workspace">
                {workspaceTabs.map((tab) => (
                  <NavLink
                    key={tab.url}
                    to={tab.url}
                    end={tab.url === "/admin"}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white"
                    activeClassName="bg-white/10 text-white shadow-sm"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">AI Active</span>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
