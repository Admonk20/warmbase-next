import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (loading) return;
    nav({ to: user ? "/dashboard" : "/auth", replace: true });
  }, [user, loading, nav]);
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Mail className="size-5 animate-pulse" />
        <span className="text-sm">Loading ColdBase Pro…</span>
      </div>
    </div>
  );
}
