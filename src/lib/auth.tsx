import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "delivery_manager" | "instructor";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  fullName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<{ role: AppRole | null; fullName: string | null }> {
  const { data, error } = await supabase.from("profiles").select("role, full_name").eq("id", userId).single();
  if (error || !data) return { role: null, fullName: null };
  return { role: (data.role as AppRole) ?? null, fullName: data.full_name ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function resolve(newSession: Session | null) {
      if (!active) return;
      setSession(newSession);

      if (!newSession) {
        setRole(null);
        setFullName(null);
        setLoading(false);
        return;
      }

      const profile = await fetchProfile(newSession.user.id);
      if (!active) return;
      setRole(profile.role);
      setFullName(profile.fullName);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setLoading(true);
      resolve(newSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!session) return;
    const profile = await fetchProfile(session.user.id);
    setRole(profile.role);
    setFullName(profile.fullName);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, fullName, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
