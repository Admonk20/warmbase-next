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
    console.debug('[useAuth] effect mounted');

    void (async () => {
      console.debug('[useAuth] initializing auth');
      try {
        const supabase = await getBrowserSupabase();
        console.debug('[useAuth] got supabase', !!supabase);
        if (!mounted) return;

        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          console.debug('[useAuth] onAuthStateChange', s);
          if (!mounted) return;
          setSession(s);
          setLoading(false);
        });

        unsubscribe = () => sub.subscription.unsubscribe();

        const { data } = await supabase.auth.getSession();
        console.debug('[useAuth] getSession result', data);
        if (!mounted) return;

        setSession(data.session);
        setLoading(false);
      } catch (error) {
        console.error('[useAuth] error', error);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      console.debug('[useAuth] cleanup');
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
          console.debug('[useAuth] signOut start');
          try {
            const supabase = await getBrowserSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Sign out error:', error);
          } catch (e) {
            console.error('Sign out failed:', e);
          } finally {
            console.debug('[useAuth] signOut: clearing session');
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
