import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Mail, Lock, Loader2, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type RoleTab = "doctor" | "patient";

const roles = [
  {
    id: "doctor" as const,
    label: "Doctor",
    icon: Stethoscope,
    color: "text-blue-600",
    description: "Access patient records, AI diagnosis & clinical decision tools",
  },
  {
    id: "patient" as const,
    label: "Patient",
    icon: User,
    color: "text-emerald-600",
    description: "View your health records, risk score and AI suggestions",
  },
];

export default function Login() {
  const [activeRole, setActiveRole] = useState<RoleTab>("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session } = useAuth();
  const selectedRole = roles.find((r) => r.id === activeRole)!;

  // ── Google OAuth ────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    try {
      localStorage.setItem("pending_role", activeRole);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      localStorage.removeItem("pending_role");
      toast({
        title: "Google sign-in failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // ── Email / Password ────────────────────────────────────────────────────
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      if (isSignUp) {
        // ── SIGN UP ──
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role: activeRole } },
        });

        if (signUpError) {
          // User already registered – switch to sign-in
          if (
            signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("already been registered") ||
            signUpError.message.toLowerCase().includes("user already exists")
          ) {
            toast({
              title: "Account already exists",
              description: "This email is already registered. Switching to sign-in.",
              variant: "destructive",
            });
            setIsSignUp(false);
            setLoading(false);
            return;
          }
          throw signUpError;
        }

        // If Supabase returned a live session immediately (email confirmation OFF)
        if (signUpData.session) {
          localStorage.setItem("pending_role", activeRole);
          toast({ title: "Account created!", description: `Welcome aboard as ${activeRole}!` });
          navigate(activeRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
          return;
        }

        // Email confirmation is required on this Supabase project.
        // Try signing in immediately in case the server auto-confirms.
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError && signInData.session) {
          localStorage.setItem("pending_role", activeRole);
          toast({ title: "Account created!", description: `Welcome aboard as ${activeRole}!` });
          navigate(activeRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
          return;
        }

        // Truly needs email confirmation
        toast({
          title: "Check your email!",
          description:
            "A confirmation link has been sent to your inbox. Click it to activate your account, then sign in here.",
        });
        setIsSignUp(false);
      } else {
        // ── SIGN IN ──
        if (session) await supabase.auth.signOut();

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed")) {
            toast({
              title: "Email not confirmed",
              description:
                "Please click the confirmation link in your inbox first, then try signing in again.",
              variant: "destructive",
            });
          } else if (
            msg.includes("invalid login credentials") ||
            msg.includes("invalid credentials") ||
            msg.includes("wrong password")
          ) {
            toast({
              title: "Wrong email or password",
              description:
                "Double-check your credentials. If you signed up with Google, use 'Continue with Google' instead.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          setLoading(false);
          return;
        }

        localStorage.setItem("pending_role", activeRole);
        navigate(activeRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
      }
    } catch (err) {
      toast({
        title: "Auth error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] bg-sidebar px-10 py-12 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-primary-foreground">MediMind AI</h1>
              <p className="text-[11px] text-sidebar-foreground/50">Predictive Clinical Intelligence</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-sidebar-primary-foreground leading-tight mb-4">
            AI-powered healthcare for modern hospitals
          </h2>
          <p className="text-sm text-sidebar-foreground/60 leading-relaxed mb-10">
            Predict risks, analyze records, and support clinical decisions — powered by Google Gemini.
          </p>
          <div className="space-y-4">
            {[
              "Multi-disease risk prediction",
              "Gemini-powered AI diagnosis",
              "Role-based access (Doctor & Patient)",
              "Secure profiles & records",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
                <span className="text-xs text-sidebar-foreground/60">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-sidebar-foreground/30">MediMind AI · Hackathon MVP</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">MediMind AI</span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight">
              {isSignUp ? "Create your account" : "Sign in to your account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Select your role to continue</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {roles.map((role) => {
              const Icon = role.icon;
              const isActive = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setActiveRole(role.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? role.color : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className={`font-medium ${selectedRole.color}`}>{selectedRole.label}: </span>
              {selectedRole.description}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full text-sm font-medium"
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 text-sm"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 text-sm"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground border-0"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isSignUp ? `Create ${selectedRole.label} Account` : `Sign In as ${selectedRole.label}`}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-medium hover:underline">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
