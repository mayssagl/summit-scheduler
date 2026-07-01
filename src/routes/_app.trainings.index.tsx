import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useRole } from "@/lib/role";
import { TRAININGS } from "@/lib/mock";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_app/trainings/")({ component: TrainingsList });

function TrainingsList() {
  const { role } = useRole();
  const list = useMemo(() => (role === "instructor" ? TRAININGS.filter((t) => t.instructorId === "i1") : role === "dm" ? TRAININGS.filter((t) => t.dmId === "dm1") : TRAININGS), [role]);
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [client, setClient] = useState("all");
  const [country, setCountry] = useState("all");

  const clients = Array.from(new Set(list.map((t) => t.client)));
  const countries = Array.from(new Set(list.map((t) => t.country)));
  const filtered = list.filter((t) => (state === "all" || t.status === state) && (client === "all" || t.client === client) && (country === "all" || t.country === country) && (q === "" || t.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My trainings</h1>
          <p className="text-sm text-muted-foreground">{role === "instructor" ? "Groups assigned to you." : "All trainings you can manage."}</p>
        </div>
        {role !== "instructor" && (
          <Button asChild><Link to="/trainings/new"><Plus className="mr-2 h-4 w-4" />New training</Link></Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-64" />
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="sm:w-36"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {["Pending","Scheduled","Active","Completed","Cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="sm:w-36"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardTitle className="sr-only">Trainings</CardTitle>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Training</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  {role === "instructor" ? <th className="px-4 py-3 text-left font-medium">Next session</th> : <th className="px-4 py-3 text-left font-medium">Country</th>}
                  <th className="px-4 py-3 text-left font-medium">Students</th>
                  <th className="px-4 py-3 text-left font-medium">State</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.client}</td>
                    {role === "instructor" ? (
                      <td className="px-4 py-3 text-muted-foreground">{t.sessions.find((s) => s.status !== "Done")?.date || "—"}</td>
                    ) : (
                      <td className="px-4 py-3 text-muted-foreground">{t.country}</td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">{t.numStudents}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/trainings/$id" params={{ id: t.id }} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}