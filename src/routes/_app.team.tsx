import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { INSTRUCTORS, DELIVERY_MANAGERS } from "@/lib/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/team")({ component: Team });

function Team() {
  const [tab, setTab] = useState("dm");
  const [picked, setPicked] = useState<string | null>(null);
  const profile = INSTRUCTORS.find((i) => i.id === picked);

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
              <InviteDialog label="Create Delivery Manager" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-left font-medium">Trainings</th><th className="px-4 py-3 text-left font-medium">NPS</th></tr></thead>
                <tbody>{DELIVERY_MANAGERS.map((d) => (<tr key={d.id} className="border-t"><td className="px-4 py-3 font-medium">{d.name}</td><td className="px-4 py-3 text-muted-foreground">{d.email}</td><td className="px-4 py-3"><span className="rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] px-2 py-0.5 text-xs text-[color:var(--status-active-fg)]">{d.status}</span></td><td className="px-4 py-3">{d.trainingCount}</td><td className="px-4 py-3">{d.nps}</td></tr>))}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ins" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Instructors</CardTitle>
              <InviteDialog label="Invite instructor" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-left font-medium">Trainings</th><th className="px-4 py-3 text-left font-medium">NPS</th></tr></thead>
                <tbody>{INSTRUCTORS.map((i) => (
                  <tr key={i.id} className={cn("border-t cursor-pointer hover:bg-muted/30", picked === i.id && "bg-muted/40")} onClick={() => setPicked(i.id)}>
                    <td className="px-4 py-3 font-medium">{i.name}</td><td className="px-4 py-3 text-muted-foreground">{i.email}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", i.status === "Active" ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]" : "bg-[color-mix(in_oklab,var(--status-pending)_30%,white)] text-[color:var(--status-pending-fg)]")}>{i.status}</span></td>
                    <td className="px-4 py-3">{i.trainingCount}</td><td className="px-4 py-3">{i.nps || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
          {profile && (
            <Card>
              <CardHeader><CardTitle className="text-base">{profile.name}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Tile label="NPS trend" value={profile.nps} icon />
                <Tile label="Avg satisfaction" value={`${profile.satisfaction}/5`} />
                <Tile label="Avg learning gain" value={`+${profile.learningGain}%`} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
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

function InviteDialog({ label }: { label: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input placeholder="Jane Doe" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="jane@trainops.co" /></div>
        </div>
        <DialogFooter><Button>Send invite</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}