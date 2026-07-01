import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "dm" | "instructor";

const RoleCtx = createContext<{ role: Role; setRole: (r: Role) => void; user: { name: string; email: string } }>({
  role: "admin",
  setRole: () => {},
  user: { name: "Alex Morgan", email: "alex@trainops.co" },
});

const USERS: Record<Role, { name: string; email: string }> = {
  admin: { name: "Alex Morgan", email: "alex@trainops.co" },
  dm: { name: "Priya Shah", email: "priya@trainops.co" },
  instructor: { name: "Jordan Lee", email: "jordan@trainops.co" },
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("admin");
  useEffect(() => {
    const r = (typeof window !== "undefined" && (localStorage.getItem("trainops:role") as Role | null)) || "admin";
    setRoleState(r);
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") localStorage.setItem("trainops:role", r);
  };
  return <RoleCtx.Provider value={{ role, setRole, user: USERS[role] }}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  return useContext(RoleCtx);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  dm: "Delivery Manager",
  instructor: "Instructor",
};