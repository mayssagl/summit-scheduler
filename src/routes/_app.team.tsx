import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RoleRoute } from "@/components/role-route";
import { useProfilesByRole, useTrainings } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { inviteUser } from "@/lib/invite-user";
import type { AppRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/team")({
  component: () => (
    <RoleRoute allowed={["admin"]}>
      <Team />
    </RoleRoute>
  ),
});

function avg(values: number[]) {
  const nonZero = values.filter((v) => v > 0);
  return nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
}

function Team() {
  const [tab, setTab] = useState("dm");
  const [picked, setPicked] = useState<string | null>(null);
  const { data: deliveryManagers = [] } = useProfilesByRole("delivery_manager");
  const { data: instructors = [] } = useProfilesByRole("instructor");
  const { data: trainings = [] } = useTrainings();

  const dmStats = useMemo(
    () =>
      new Map(
        deliveryManagers.map((d) => {
          const owned = trainings.filter((t) => t.created_by === d.id);
          return [d.id, { trainingCount: owned.length, nps: avg(owned.map((t) => t.nps)) }];
        }),
      ),
    [deliveryManagers, trainings],
  );

  const instructorStats = useMemo(
    () =>
      new Map(
        instructors.map((i) => {
          const assigned = trainings.filter((t) => t.instructor_id === i.id);
          return [
            i.id,
            {
              trainingCount: assigned.length,
              nps: avg(assigned.map((t) => t.nps)),
              learningGain: avg(assigned.map((t) => t.learning_gain)),
            },
          ];
        }),
      ),
    [instructors, trainings],
  );

  const profile = instructors.find((i) => i.id === picked);
  const profileStats = profile ? instructorStats.get(profile.id) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Delivery managers and instructors.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="dm">Delivery Managers</TabsTrigger><TabsTrigger value="ins">Instructors</TabsTrigger></TabsList>
        <TabsContent value="dm" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Delivery Managers</CardTitle>
              <InviteDialog label="Create Delivery Manager" role="delivery_manager" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-left font-medium">Trainings</th><th className="px-4 py-3 text-left font-medium">NPS</th></tr></thead>
                <tbody>{deliveryManagers.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{d.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.email}</td>
                    <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                    <td className="px-4 py-3">{dmStats.get(d.id)?.trainingCount ?? 0}</td>
                    <td className="px-4 py-3">{dmStats.get(d.id)?.nps || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ins" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Instructors</CardTitle>
              <InviteDialog label="Invite instructor" role="instructor" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-left font-medium">Trainings</th><th className="px-4 py-3 text-left font-medium">NPS</th></tr></thead>
                <tbody>{instructors.map((i) => (
                  <tr key={i.id} className={cn("border-t cursor-pointer hover:bg-muted/30", picked === i.id && "bg-muted/40")} onClick={() => setPicked(i.id)}>
                    <td className="px-4 py-3 font-medium">{i.full_name}</td><td className="px-4 py-3 text-muted-foreground">{i.email}</td>
                    <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                    <td className="px-4 py-3">{instructorStats.get(i.id)?.trainingCount ?? 0}</td><td className="px-4 py-3">{instructorStats.get(i.id)?.nps || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
          {profile && (
            <Card>
              <CardHeader><CardTitle className="text-base">{profile.full_name}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Tile label="NPS trend" value={profileStats?.nps ?? 0} icon />
                <Tile label="Avg learning gain" value={`+${profileStats?.learningGain ?? 0}%`} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        active
          ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"
          : "bg-[color-mix(in_oklab,var(--status-pending)_30%,white)] text-[color:var(--status-pending-fg)]",
      )}
    >
      {active ? "Active" : "Invited"}
    </span>
  );
}

function Tile({ label, value, icon }: { label: string; value: React.ReactNode; icon?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">{value}{icon && <TrendingUp className="h-4 w-4 text-[color:var(--status-active-fg)]" />}</div>
    </div>
  );
}

function InviteDialog({ label, role }: { label: string; role: AppRole }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // getSession() only reads whatever is cached in local storage, which can
      // be a stale/expired access token if this tab has been open a while —
      // refreshSession() actively round-trips to Supabase for a token that's
      // guaranteed valid right now, which is what the server call below checks.
      const {
        data: { session },
      } = await supabase.auth.refreshSession();
      if (!session) throw new Error("Your session has expired — please sign out and sign in again.");
      const redirectTo = `${window.location.origin}/activate`;
      await inviteUser({ data: { email, fullName: name, role, accessToken: session.access_token, redirectTo } });
      queryClient.invalidateQueries({ queryKey: ["profiles", role] });
      setName("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5"><Label>Name</Label><Input placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="jane@trainops.co" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Sending…" : "Send invite"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
