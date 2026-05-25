import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Send, Workflow, BarChart3, Settings, LogOut, Mail, Sparkles, KanbanSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssistantWidget } from "@/components/assistant-widget";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sourcing", label: "Sourcing", icon: Sparkles },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/sequences", label: "Sequences", icon: Workflow },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/deliverability", label: "Deliverability", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];


export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Mail className="size-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">ColdBase Pro</div>
            <div className="text-[11px] text-muted-foreground">Outbound, sourced & sent</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => {
            const active = path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-2 px-1 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      <AssistantWidget />
    </div>
  );
}
