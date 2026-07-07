import { Link, useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  GraduationCap,
  Wallet,
  ClipboardList,
  Users,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

const BASE = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/trainings", label: "My trainings", icon: GraduationCap },
  { to: "/payout", label: "Payout", icon: Wallet },
] as const;

const ADMIN_EXTRA = [
  { to: "/surveys", label: "Surveys", icon: ClipboardList },
  { to: "/team", label: "Team", icon: Users },
] as const;

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  delivery_manager: "Delivery Manager",
  instructor: "Instructor",
};

export function AppShell() {
  const { role, fullName, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const items = role === "admin" ? [...BASE, ...ADMIN_EXTRA] : BASE;
  const displayName = fullName || user?.email || "";
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

  const NavInner = (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]"
                : "text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b bg-[color:var(--sidebar)] px-4 lg:hidden">
        <div className="flex items-center gap-2 text-[color:var(--sidebar-foreground)]">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary font-bold text-primary-foreground">T</div>
          <span className="font-semibold">TrainOps</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)]"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[color:var(--sidebar)] pt-14 transition-transform lg:static lg:translate-x-0 lg:pt-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="hidden h-16 items-center gap-2 border-b border-[color:var(--sidebar-border)] px-5 text-[color:var(--sidebar-foreground)] lg:flex">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary font-bold text-primary-foreground">T</div>
          <span className="text-lg font-semibold">TrainOps</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">{NavInner}</div>
        <div className="border-t border-[color:var(--sidebar-border)] p-4">
          <div className="flex items-center gap-3 text-[color:var(--sidebar-foreground)]">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--sidebar-accent)] text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-[color:var(--sidebar-foreground)]/60">{role ? ROLE_LABEL[role] : ""}</p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              className="rounded-md p-2 hover:bg-[color:var(--sidebar-accent)]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <main className="flex-1 pt-14 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
