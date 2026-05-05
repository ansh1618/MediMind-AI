import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Stethoscope, FileText, MessageSquare, Activity,
  Menu, X, Brain, Upload, LogOut, User, ShieldCheck, HeartPulse,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const doctorNav = [
  { path: "/doctor-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/records/upload", label: "Upload Record", icon: Upload },
  { path: "/diagnosis", label: "AI Diagnosis", icon: Stethoscope },
  { path: "/reports", label: "Report Analyzer", icon: FileText },
  { path: "/chat", label: "AI Assistant", icon: MessageSquare },
];
const patientNav = [
  { path: "/patient-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/records/upload", label: "Upload Record", icon: Upload },
  { path: "/diagnosis", label: "AI Diagnosis", icon: Stethoscope },
  { path: "/reports", label: "My Reports", icon: FileText },
  { path: "/chat", label: "AI Assistant", icon: MessageSquare },
];

const roleConfig: Record<string, { nav: typeof doctorNav; label: string; icon: React.ElementType; badgeClass: string }> = {
  doctor: { nav: doctorNav, label: "Doctor", icon: Stethoscope, badgeClass: "text-blue-400 bg-blue-950/50 border-blue-900" },
  admin:  { nav: doctorNav, label: "Admin",  icon: ShieldCheck, badgeClass: "text-purple-400 bg-purple-950/50 border-purple-900" },
  patient:{ nav: patientNav,label: "Patient", icon: HeartPulse, badgeClass: "text-emerald-400 bg-emerald-950/50 border-emerald-900" },
};


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, roles, signOut } = useAuth();

  // ProtectedRoute already guarantees the user is authenticated.
  // Derive the role with a "patient" fallback so the layout never blocks.
  const primaryRole = roles[0] ?? "patient";
  const config = roleConfig[primaryRole] ?? roleConfig["patient"];
  const RoleIcon = config.icon;

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("pending_role");
      await signOut();
    } catch (e) {
      console.error("[DashboardLayout] signOut error:", e);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Brain className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-primary-foreground">MediMind AI</h1>
          <p className="text-[10px] text-sidebar-foreground/50">Clinical Intelligence</p>
        </div>
      </div>

      <div className={`mx-4 mb-4 px-3 py-1.5 rounded-lg border flex items-center gap-2 ${config.badgeClass}`}>
        <RoleIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-medium">{config.label} Portal</span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {config.nav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-sidebar-foreground/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sidebar-foreground/80 truncate">{user.email}</p>
              <p className={`text-[10px] font-medium capitalize ${config.badgeClass.split(" ")[0]}`}>{config.label}</p>
            </div>
            <button onClick={handleSignOut} className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors ml-1" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-2">
          <Activity className="w-3.5 h-3.5 text-success animate-pulse-dot" />
          <span className="text-[11px] text-sidebar-foreground/40">System Online</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border shrink-0">
        <NavContent />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">MediMind</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${config.badgeClass}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleSignOut} className="p-2 text-muted-foreground hover:text-foreground"><LogOut className="w-4 h-4" /></button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, x: -260 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -260 }} className="lg:hidden fixed inset-0 z-40 flex">
            <div className="w-60 bg-sidebar border-r border-sidebar-border pt-14"><NavContent /></div>
            <div className="flex-1 bg-foreground/20" onClick={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto lg:pt-0 pt-14">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
