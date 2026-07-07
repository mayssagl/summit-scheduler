import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";

const ALL_ROLES: AppRole[] = ["admin", "delivery_manager", "instructor"];

interface RoleRouteProps {
  allowed?: AppRole[];
  children: ReactNode;
}

function Spinner() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );
}

export function RoleRoute({ allowed = ALL_ROLES, children }: RoleRouteProps) {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const authorized = !loading && !!session && !!role && allowed.includes(role);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!role || !allowed.includes(role)) {
      navigate({ to: "/dashboard", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, role, navigate]);

  if (!authorized) {
    return <Spinner />;
  }

  return <>{children}</>;
}
