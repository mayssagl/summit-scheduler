import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  delivery_manager: "Delivery Manager",
  instructor: "Instructor",
};

function Settings() {
  const { user, fullName, role, refreshProfile } = useAuth();

  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    if (!name.trim() || !user) return;
    setNameSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Name updated.");
      setName("");
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  }

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    if (!email) return;
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("Check your new email inbox for a confirmation link.");
      setEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your own account.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {fullName || "—"}</p>
          <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
          <p><span className="text-muted-foreground">Role:</span> {role ? ROLE_LABEL[role] : "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change name</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleNameSubmit}>
            <div className="space-y-1.5">
              <Label>New name</Label>
              <Input type="text" placeholder={fullName ?? ""} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {nameError && <p role="alert" className="text-sm text-destructive">{nameError}</p>}
            <Button type="submit" disabled={nameSaving}>{nameSaving ? "Saving…" : "Update name"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change email</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleEmailSubmit}>
            <div className="space-y-1.5">
              <Label>New email</Label>
              <Input type="email" placeholder={user?.email ?? ""} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {emailError && <p role="alert" className="text-sm text-destructive">{emailError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={emailSaving}>{emailSaving ? "Saving…" : "Update email"}</Button>
              <p className="text-xs text-muted-foreground">You'll need to confirm via a link sent to the new address.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handlePasswordSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm new password</Label>
                <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
              </div>
            </div>
            {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
            <Button type="submit" disabled={passwordSaving}>{passwordSaving ? "Saving…" : "Update password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
