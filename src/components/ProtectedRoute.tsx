import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: UserRole }) {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  if (requiredRole === "admin" && role !== "admin") return <Navigate to="/dashboard" replace />;
  if (requiredRole === "recruiter" && role !== "recruiter" && role !== "admin") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
