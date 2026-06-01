import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const supabase = await getBrowserSupabase();
        if (!mounted) return;

        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          if (!mounted) return;
          setSession(s);
          setLoading(false);
        });

        unsubscribe = () => sub.subscription.unsubscribe();

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(data.session);
        setLoading(false);
      } catch (error) {
        console.error(error);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          try {
            const supabase = await getBrowserSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) console.error("Sign out error:", error);
          } catch (e) {
            console.error("Sign out failed:", e);
          } finally {
            // Ensure local session state is cleared to avoid race conditions
            // that can lead to aborted network calls during navigation.
            setSession(null);
          }
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
