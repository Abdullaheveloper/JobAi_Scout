import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { Link, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FileUp, Briefcase, Bookmark, BarChart3, Users, UserCog, LogOut,
  Shield, Mic, Zap, Plus, CalendarClock, Bell,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MixedDir } from "@/components/MixedDir";
import { supabase } from "@/integrations/supabase/client";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";

function AppSidebar() {
  const { t, i18n } = useTranslation();
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const sidebarSide = isRtlLocale(resolveLocale(i18n.resolvedLanguage || i18n.language))
    ? "right"
    : "left";

  const userNav = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("nav.uploadCv"), url: "/dashboard/cv", icon: FileUp },
    { title: t("nav.browseJobs"), url: "/dashboard/jobs", icon: Briefcase },
    { title: t("nav.automation"), url: "/dashboard/automation", icon: CalendarClock },
    { title: t("nav.savedJobs"), url: "/dashboard/saved", icon: Bookmark },
    { title: t("nav.formFill"), url: "/dashboard/auto-fill", icon: Zap },
    { title: t("nav.voiceAssistant"), url: "/dashboard/assistant", icon: Mic },
    { title: t("nav.profileSettings"), url: "/dashboard/settings", icon: UserCog },
  ];

  const recruiterNav = [
    { title: t("nav.companyProfile"), url: "/recruiter/profile", icon: UserCog },
    { title: t("nav.postJob"), url: "/recruiter/jobs?new=1", icon: Plus },
    { title: t("nav.myJobs"), url: "/recruiter/jobs", icon: Briefcase },
    { title: t("nav.applicants"), url: "/recruiter/candidates", icon: Users },
    { title: t("nav.applicationStatus"), url: "/recruiter/application-status", icon: BarChart3 },
  ];

  const adminNav = [
    { title: t("nav.adminDashboard"), url: "/admin", icon: Shield },
    { title: t("nav.manageUsers"), url: "/admin/users", icon: Users },
    { title: t("nav.manageJobs"), url: "/admin/jobs", icon: Briefcase },
    { title: t("nav.platformAnalytics"), url: "/admin/analytics", icon: BarChart3 },
  ];

  let navItems = userNav;
  if (role === "recruiter") navItems = recruiterNav;
  else if (role === "admin") navItems = adminNav;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const portalLabel =
    role === "recruiter"
      ? t("nav.recruiterPortal")
      : role === "admin"
        ? t("nav.adminPortal")
        : t("nav.jobSeekerPortal");
  const roleColor = role === "recruiter"
    ? "text-cyan-600 dark:text-cyan-400"
    : role === "admin"
      ? "text-rose-600 dark:text-rose-400"
      : "text-indigo-600 dark:text-indigo-400";

  return (
    <Sidebar
      collapsible="icon"
      side={sidebarSide}
      className="portal-sidebar border-e"
    >
      <SidebarContent className="flex flex-col">
        <div className={`flex items-center gap-3 p-4 border-b border-indigo-500/10 ${collapsed ? "justify-center" : ""}`}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <JobAILogo showWordmark={!collapsed} markClassName="h-9 w-9" />
          </motion.div>
        </div>

        {!collapsed && (
          <div className="px-4 pt-3 pb-1">
            <span className={`text-xs font-semibold tracking-wider uppercase ${roleColor}`}>{portalLabel}</span>
          </div>
        )}

        <SidebarGroup className="flex-1 px-2 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title + item.url}>
                  <SidebarMenuButton asChild className="h-10 rounded-xl">
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard" || item.url === "/admin"}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-indigo-500/10 ${collapsed ? "justify-center" : ""}`}
                      activeClassName="bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-e-2 border-indigo-500 font-medium"
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

        <div className="border-t border-indigo-500/10 p-3">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <Avatar className="h-8 w-8 ring-2 ring-indigo-500/30">
              <AvatarFallback
                className="text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.25) 100%)" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  <MixedDir>{profile?.full_name || t("common.user")}</MixedDir>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  <MixedDir>{profile?.email}</MixedDir>
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => { signOut(); navigate("/"); }}
                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-muted-foreground hover:text-rose-500 dark:hover:text-rose-400 transition-all"
                title={t("common.signOut")}
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
  const { t } = useTranslation();
  const { role, profile, clearApprovalNotice } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const workspaceTabs = role === "admin"
    ? [{ label: t("nav.admin"), url: "/admin", icon: Shield }]
    : role === "recruiter"
      ? [{ label: t("nav.recruitment"), url: "/recruiter/jobs", icon: Users }]
      : [];

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;

    const loadPending = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending");
      if (!cancelled) setPendingCount(count || 0);
    };

    loadPending();
    const interval = setInterval(loadPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [role]);

  useEffect(() => {
    const typed = profile as { approval_notice?: string | null; approval_status?: string } | null;
    if (typed?.approval_notice && typed.approval_status === "approved") {
      clearApprovalNotice();
    }
  }, [profile, clearApprovalNotice]);

  return (
    <SidebarProvider>
      <div className="portal-shell min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="portal-header flex min-h-14 flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-4 w-px bg-border" />
            <h2
              className="hidden font-semibold text-foreground text-sm sm:block"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              {t("brand.tagline")}
            </h2>
            {workspaceTabs.length > 0 && (
              <nav className="flex items-center rounded-lg border border-border bg-secondary/40 p-1" aria-label={t("nav.workspace")}>
                {workspaceTabs.map((tab) => (
                  <NavLink
                    key={tab.url}
                    to={tab.url}
                    end={tab.url === "/admin"}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    activeClassName="bg-background text-foreground shadow-sm"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            )}
            <div className="ms-auto flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
              {role === "admin" && (
                <Link
                  to="/admin/users?filter=pending"
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-amber-500/30 hover:text-amber-500"
                  title={t("nav.pendingApprovals")}
                  aria-label={`${pendingCount} ${t("nav.pendingApprovals")}`}
                >
                  <Bell className="h-4 w-4" />
                  {pendingCount > 0 && (
                    <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </Link>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t("common.aiActive")}</span>
              </div>
            </div>
          </header>

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
