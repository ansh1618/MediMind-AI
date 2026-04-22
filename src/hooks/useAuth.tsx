import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "doctor" | "patient" | "admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  roles: [],
  loading: true,
  hasRole: () => false,
  signOut: async () => {},
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("[useAuth] fetchUserRoles error:", error.message);
      return [];
    }
    return (data ?? []).map((r) => r.role as AppRole);
  } catch (e) {
    console.error("[useAuth] fetchUserRoles threw:", e);
    return [];
  }
}

async function ensureRoleRow(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "patient" });
      if (error) console.error("[useAuth] ensureRoleRow insert error:", error.message);
    }
  } catch (e) {
    console.error("[useAuth] ensureRoleRow threw:", e);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Tracks which userId we have already fetched roles for.
  // Prevents duplicate fetches when both getSession + onAuthStateChange fire.
  const resolvedUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // SAFETY NET: force-clear loading after 8 s so the UI never hangs forever.
  useEffect(() => {
    const t = setTimeout(() => {
      if (mountedRef.current) {
        console.warn("[useAuth] safety-net timeout — forcing loading=false");
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const resolveSession = async (newSession: Session | null) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      const userId = newSession?.user?.id ?? null;

      if (!userId) {
        // Signed out
        setRoles([]);
        resolvedUserIdRef.current = null;
        setLoading(false);
        return;
      }

      // Already resolved roles for this user — don't refetch, just clear loading.
      if (resolvedUserIdRef.current === userId) {
        setLoading(false);
        return;
      }

      // Mark as resolved BEFORE the awaits so concurrent calls skip the fetch.
      resolvedUserIdRef.current = userId;

      try {
        await ensureRoleRow(userId);
        let fetched = await fetchUserRoles(userId);

        // Apply pending role saved before Google OAuth redirect.
        // ALWAYS override in-memory — guarantees correct routing even if DB fails.
        const pendingRole = localStorage.getItem("pending_role") as AppRole | null;
        if (pendingRole && pendingRole !== "admin") {
          localStorage.removeItem("pending_role");
          fetched = [pendingRole]; // immediate override regardless of DB
          // Best-effort DB sync in background
          supabase.from("user_roles").delete().eq("user_id", userId)
            .then(() => supabase.from("user_roles").insert({ user_id: userId, role: pendingRole }))
            .catch(() => {});
        } else if (pendingRole) {
          localStorage.removeItem("pending_role");
        }

        if (mountedRef.current) setRoles(fetched);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    // 1. Get the current session (covers page refreshes and OAuth redirects).
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      resolveSession(s);
    });

    // 2. Subscribe to future auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        resolveSession(newSession);
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const role: AppRole | null = roles[0] ?? null;
  const hasRole = (r: AppRole) => roles.includes(r);

  const signOut = async () => {
    resolvedUserIdRef.current = null;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, role, roles, loading, hasRole, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
