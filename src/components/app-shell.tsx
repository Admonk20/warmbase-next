import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Send, Settings, LogOut, Mail, Sparkles, KanbanSquare, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssistantWidget } from "@/components/assistant-widget";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/automation", label: "Automation", icon: Zap },
  { to: "/sourcing", label: "Sourcing", icon: Sparkles },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col shadow-xl z-20">
        <div className="px-6 py-8 border-b border-sidebar-border/50 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary shadow-lg shadow-primary/20 text-primary-foreground grid place-items-center">
            <Mail className="size-5" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">WarmBase</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Autonomous OS</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:translate-x-1",
                )}
              >
                <n.icon className={cn("size-4.5 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/10">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-accent grid place-items-center text-[10px] font-bold text-white uppercase">
              {user?.email?.slice(0, 2) ?? "??"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{user?.email?.split('@')[0]}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 rounded-xl hover:bg-destructive/5 hover:text-destructive text-muted-foreground" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto bg-muted/20">
        <div className="relative min-h-screen">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          {children}
        </div>
      </main>
      {!(path === "/automation" || path.startsWith("/automation/")) && <AssistantWidget />}
    </div>
  );
}
