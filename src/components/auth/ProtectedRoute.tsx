import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  // Still bootstrapping — show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  // Not authenticated → /login
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Role mismatch → redirect to own dashboard
  // If role is null (e.g. user_roles table empty) treat as "patient" to avoid infinite hang
  const effectiveRole = role ?? "patient";
  if (requiredRole && effectiveRole !== requiredRole && effectiveRole !== "admin") {
    const target = effectiveRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
