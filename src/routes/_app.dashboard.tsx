import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useRole } from "@/lib/role";
import { TRAININGS } from "@/lib/mock";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Clock, Sparkles, BarChart3, ArrowUpRight, CalendarCheck, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { role } = useRole();
  const all = useMemo(() => (role === "dm" ? TRAININGS.filter((t) => t.dmId === "dm1") : role === "instructor" ? TRAININGS.filter((t) => t.instructorId === "i1") : TRAININGS), [role]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = all.filter((t) => (status === "all" || t.status === status) && (q === "" || t.name.toLowerCase().includes(q.toLowerCase()) || t.client.toLowerCase().includes(q.toLowerCase())));
  const active = all.filter((t) => t.status === "Active").length;
  const pending = all.filter((t) => t.status === "Pending").length;
  const npsValues = all.filter((t) => t.nps > 0).map((t) => t.nps);
  const avgNps = npsValues.length ? Math.round(npsValues.reduce((a, b) => a + b, 0) / npsValues.length) : 0;
  const surveyValues = all.filter((t) => t.surveyRate > 0).map((t) => t.surveyRate);
  const surveyRate = surveyValues.length ? Math.round(surveyValues.reduce((a, b) => a + b, 0) / surveyValues.length) : 0;

  const nextUp = all.flatMap((t) => t.sessions.filter((s) => s.status !== "Done").map((s) => ({ t, s }))).sort((a, b) => a.s.date.localeCompare(b.s.date))[0];
  const sessionsThisWeek = all.reduce((acc, t) => acc + t.sessions.filter((s) => {
    const d = new Date(s.date); const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= -1 && diff <= 7;
  }).length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of {role === "admin" ? "all trainings across the org" : role === "dm" ? "your trainings" : "your assigned sessions"}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === "instructor" ? (
          <>
            <StatCard label="Trainings" value={all.length} icon={GraduationCap} />
            <StatCard label="Sessions this week" value={sessionsThisWeek} icon={CalendarCheck} />
            <StatCard label="My NPS" value={avgNps} icon={Sparkles} />
            <StatCard label="Students" value={all.reduce((a, t) => a + t.numStudents, 0)} icon={Users} />
          </>
        ) : (
          <>
            <StatCard label="Active" value={active} icon={Activity} />
            <StatCard label="Pending" value={pending} icon={Clock} />
            <StatCard label="Avg NPS" value={avgNps} icon={Sparkles} />
            <StatCard label="Survey rate" value={`${surveyRate}%`} icon={BarChart3} />
          </>
        )}
      </div>

      {role === "instructor" && nextUp && (
        <Card>
          <CardHeader><CardTitle className="text-base">Next up</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{nextUp.t.name} <span className="text-muted-foreground font-normal">· {nextUp.t.client}</span></p>
              <p className="mt-0.5 text-sm text-muted-foreground">{nextUp.s.date} · {nextUp.s.start}–{nextUp.s.end} · {nextUp.s.venue}</p>
            </div>
            <Button asChild><Link to="/trainings/$id" params={{ id: nextUp.t.id }}>Take attendance</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Trainings</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-56" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Training</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Dates</th>
                  <th className="px-4 py-3 text-left font-medium">State</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.client}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.startDate ? `${t.startDate} → ${t.endDate}` : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/trainings/$id" params={{ id: t.id }} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No trainings match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}