import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { getBrowserSupabase } from "@/integrations/supabase/browser-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const pwSchema = z.string().min(8, "At least 8 characters").max(72);
const nameSchema = z.string().trim().min(1, "Enter your name").max(80);

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard", replace: true });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const em = emailSchema.parse(email);
      const pw = pwSchema.parse(password);
      const supabase = await getBrowserSupabase();
      if (mode === "signup") {
        const nm = nameSchema.parse(name);
        const { error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: nm },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      const raw = err?.message || String(err) || "Something went wrong";
      const lowered = raw.toLowerCase();
      let friendly = raw;
      if (lowered.includes("weak") || lowered.includes("easy to guess")) {
        friendly = "Password is too weak — choose a stronger password (min 8 characters, include numbers and symbols).";
      } else if (lowered.includes("invalid") && lowered.includes("email")) {
        friendly = "Please enter a valid email address.";
      } else if (lowered.includes("duplicate") || lowered.includes("already")) {
        friendly = "An account with this email already exists.";
      } else if (lowered.includes("confirm") || lowered.includes("verify")) {
        friendly = "Please verify your email address before signing in.";
      }
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const supabase = await getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        // Provide a clearer message when OAuth is misconfigured
        const msg = error?.message || "Google sign-in failed";
        if (msg.toLowerCase().includes("missing oauth") || msg.toLowerCase().includes("missing secret")) {
          toast.error("Google OAuth is not configured in Supabase. Add the client ID & secret in Supabase > Auth > Providers.");
        } else {
          toast.error(msg);
        }
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      toast.error(err?.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Mail className="size-5" />
          </div>
          <span className="font-semibold text-xl tracking-tight">WarmBase</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tighter">The autonomous growth engine.</h1>
          <p className="text-lg text-muted-foreground">Sourcing, research, and outreach — running 24/7 on autopilot.</p>
          <ul className="text-sm text-muted-foreground space-y-3">
            <li className="flex gap-2 items-start"><Lock className="size-5 mt-0.5 text-primary shrink-0" /> Enterprise-grade security with encrypted secrets and RLS.</li>
            <li className="flex gap-2 items-start"><Mail className="size-5 mt-0.5 text-primary shrink-0" /> Multi-provider AI orchestration with Kimi, Claude, and OpenAI.</li>
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} WarmBase</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-md border-none shadow-2xl bg-background/80 backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your autonomous workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-8">
                <TabsTrigger value="signin" className="text-xs uppercase tracking-widest font-semibold">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="text-xs uppercase tracking-widest font-semibold">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value={mode} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <Button type="button" variant="outline" className="w-full h-11 relative" onClick={google} disabled={busy}>
                  <svg viewBox="0 0 24 24" className="size-4 mr-2"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"/></svg>
                  Continue with Google
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <form onSubmit={submit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" placeholder="John Doe" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="name@company.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        className="pr-10"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 font-bold" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin mr-2" />}
                    {mode === "signin" ? "Sign in to WarmBase" : "Create account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center px-8">
                    By clicking continue, you agree to our <a href="/terms" className="underline underline-offset-4 hover:text-primary">Terms of Service</a> and <a href="/privacy" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
