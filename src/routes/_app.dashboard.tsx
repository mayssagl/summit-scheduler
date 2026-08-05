import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  sendSurveysToStudents,
  useAllAttendance,
  useAllCertificates,
  useAllGroupInsights,
  useAllSessions,
  useAllStudents,
  useAllSurveyResponses,
  useProfilesByRole,
  useTrainings,
} from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Award, CalendarCheck, GraduationCap, Plus, Send, Sparkles, Users, Wallet, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

const DEFAULT_PAYOUT_RATE = 450;

// Nothing in the app ever updates sessions.status away from its DB default
// ('Ahead'), so it can't be trusted for "has this session happened yet" —
// derive that from the session's own date instead.
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeAgo(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function Dashboard() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { data: all = [] } = useTrainings();
  const { data: sessions = [] } = useAllSessions();
  const { data: attendance = [] } = useAllAttendance();
  const { data: certificates = [] } = useAllCertificates();
  const { data: surveyResponses = [] } = useAllSurveyResponses();
  const { data: groupInsights = [] } = useAllGroupInsights();
  const { data: allStudents = [] } = useAllStudents();
  const { data: instructors = [] } = useProfilesByRole("instructor");
  const rateByInstructor = useMemo(() => new Map(instructors.map((i) => [i.id, i.payout_rate])), [instructors]);

  // No cron/scheduled job is available to this app, so this is a lazy
  // check: whenever an admin/DM has the dashboard open, look for trainings
  // that have finished (or hit the L3 one-month mark) without their survey
  // sent yet, and send it. autoSentRef guards against double-firing (e.g.
  // React StrictMode's double effect invocation) before the DB write we
  // just made is reflected back in surveyResponses.
  const autoSentRef = useRef(new Set<string>());
  useEffect(() => {
    if (role === "instructor" || all.length === 0) return;
    const todayStr = toLocalDateStr(new Date());
    const sentL1 = new Set(surveyResponses.filter((r) => r.level === "l1").map((r) => r.training_id));
    const sentL3 = new Set(surveyResponses.filter((r) => r.level === "l3").map((r) => r.training_id));

    for (const t of all) {
      if (!t.end_date || t.end_date >= todayStr) continue; // training hasn't finished yet
      const activeStudentIds = allStudents.filter((s) => s.training_id === t.id && s.status === "Active").map((s) => s.id);
      if (activeStudentIds.length === 0) continue;

      const fire = (level: "l1" | "l3") => {
        const key = `${t.id}:${level}`;
        if (autoSentRef.current.has(key)) return;
        autoSentRef.current.add(key);
        sendSurveysToStudents(t.id, level, activeStudentIds)
          .then(() => queryClient.invalidateQueries({ queryKey: ["survey-responses"] }))
          .catch(() => autoSentRef.current.delete(key)); // allow retry on next effect run
      };

      if (!sentL1.has(t.id)) fire("l1");

      const l3DueStr = toLocalDateStr(new Date(new Date(t.end_date).getTime() + 30 * 24 * 60 * 60 * 1000));
      if (l3DueStr <= todayStr && !sentL3.has(t.id)) fire("l3");
    }
  }, [all, allStudents, surveyResponses, role, queryClient]);

  const active = all.filter((t) => t.status === "Active").length;
  const npsValues = all.filter((t) => t.nps > 0).map((t) => t.nps);
  const avgNps = npsValues.length ? Math.round(npsValues.reduce((a, b) => a + b, 0) / npsValues.length) : 0;
  const totalStudents = all.reduce((a, t) => a + t.num_students, 0);

  const trainingsById = useMemo(() => new Map(all.map((t) => [t.id, t])), [all]);
  const todayStr = toLocalDateStr(new Date());

  const nextUp = useMemo(
    () =>
      sessions
        .filter((s) => s.date >= todayStr && trainingsById.has(s.training_id))
        .map((s) => ({ s, t: trainingsById.get(s.training_id)! }))
        .sort((a, b) => a.s.date.localeCompare(b.s.date))[0],
    [sessions, trainingsById, todayStr],
  );
  const sessionsThisWeek = sessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= -1 && diff <= 7;
  }).length;

  const monthlyDelivery = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("en", { month: "short" }) };
    });
    return months.map(({ year, month, label }) => ({
      label,
      count: sessions.filter((s) => {
        if (s.date >= todayStr) return false;
        const d = new Date(s.date);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length,
    }));
  }, [sessions, todayStr]);
  const maxDelivery = Math.max(1, ...monthlyDelivery.map((m) => m.count));
  const hasAnyDelivery = monthlyDelivery.some((m) => m.count > 0);

  const instructorPayouts = useMemo(() => {
    const now = new Date();
    const attendedSessionIds = new Set(attendance.map((a) => a.session_id));
    const byInstructor = new Map<string, { name: string; sessions: number; unmarked: number; payout: number }>();
    for (const s of sessions) {
      if (s.date >= todayStr) continue;
      const d = new Date(s.date);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
      const t = trainingsById.get(s.training_id);
      if (!t?.instructor_id) continue;
      const entry = byInstructor.get(t.instructor_id) ?? {
        name: t.instructor_name ?? "Unassigned",
        sessions: 0,
        unmarked: 0,
        payout: 0,
      };
      entry.sessions += 1;
      entry.payout += rateByInstructor.get(t.instructor_id) ?? DEFAULT_PAYOUT_RATE;
      if (!attendedSessionIds.has(s.id)) entry.unmarked += 1;
      byInstructor.set(t.instructor_id, entry);
    }
    return Array.from(byInstructor.values()).sort((a, b) => b.payout - a.payout);
  }, [sessions, attendance, trainingsById, todayStr, rateByInstructor]);

  const pendingPayout = useMemo(() => {
    const doneByTraining = new Map<string, number>();
    for (const s of sessions) {
      if (s.date >= todayStr) continue;
      doneByTraining.set(s.training_id, (doneByTraining.get(s.training_id) ?? 0) + 1);
    }
    let total = 0;
    const instructorIds = new Set<string>();
    for (const t of all) {
      if (t.status === "Completed") continue;
      const done = doneByTraining.get(t.id) ?? 0;
      if (done === 0) continue;
      const rate = t.instructor_id ? (rateByInstructor.get(t.instructor_id) ?? DEFAULT_PAYOUT_RATE) : DEFAULT_PAYOUT_RATE;
      total += done * rate;
      if (t.instructor_id) instructorIds.add(t.instructor_id);
    }
    return { total, instructorCount: instructorIds.size };
  }, [sessions, all, todayStr, rateByInstructor]);

  const recentActivity = useMemo(() => {
    type EventItem = { key: string; icon: LucideIcon; text: string; time: Date };
    const events: EventItem[] = [];

    const certGroups = new Map<string, { trainingId: string; time: Date; count: number }>();
    for (const c of certificates) {
      if (!c.issued_at) continue;
      const time = new Date(c.issued_at);
      const bucket = `${c.training_id}:${Math.floor(time.getTime() / 60000)}`;
      const g = certGroups.get(bucket) ?? { trainingId: c.training_id, time, count: 0 };
      g.count += 1;
      certGroups.set(bucket, g);
    }
    for (const g of certGroups.values()) {
      events.push({
        key: `cert:${g.trainingId}:${g.time.getTime()}`,
        icon: Award,
        text: `${g.count} certificate${g.count > 1 ? "s" : ""} issued — ${trainingsById.get(g.trainingId)?.name ?? "a training"}`,
        time: g.time,
      });
    }

    const surveyGroups = new Map<string, { trainingId: string; level: string; time: Date; count: number }>();
    for (const r of surveyResponses) {
      const time = new Date(r.created_at);
      const bucket = `${r.training_id}:${r.level}:${Math.floor(time.getTime() / 60000)}`;
      const g = surveyGroups.get(bucket) ?? { trainingId: r.training_id, level: r.level, time, count: 0 };
      g.count += 1;
      surveyGroups.set(bucket, g);
    }
    for (const g of surveyGroups.values()) {
      events.push({
        key: `survey:${g.trainingId}:${g.level}:${g.time.getTime()}`,
        icon: Send,
        text: `${g.level.toUpperCase()} survey sent to ${g.count} student${g.count > 1 ? "s" : ""} — ${trainingsById.get(g.trainingId)?.name ?? "a training"}`,
        time: g.time,
      });
    }

    for (const gi of groupInsights) {
      events.push({
        key: `insight:${gi.training_id}`,
        icon: Sparkles,
        text: `AI group report ${gi.status === "published" ? "approved" : "drafted"} — ${trainingsById.get(gi.training_id)?.name ?? "a training"}`,
        time: new Date(gi.generated_at),
      });
    }

    return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [certificates, surveyResponses, groupInsights, trainingsById]);

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of all) map.set(t.client, (map.get(t.client) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([client, count]) => ({ client, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [all]);

  const monthLabel = new Date().toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel} · {role === "admin" ? "all clients" : role === "delivery_manager" ? "your trainings" : "your assigned sessions"}
          </p>
        </div>
        {role !== "instructor" && (
          <Button asChild>
            <Link to="/trainings/new"><Plus className="mr-2 h-4 w-4" />New training</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === "instructor" ? (
          <>
            <StatCard label="Trainings" value={all.length} icon={GraduationCap} />
            <StatCard label="Sessions this week" value={sessionsThisWeek} icon={CalendarCheck} />
            <StatCard label="My NPS" value={avgNps} icon={Sparkles} />
            <StatCard label="Students" value={totalStudents} icon={Users} />
          </>
        ) : (
          <>
            <StatCard label="Active trainings" value={active} icon={Activity} />
            <StatCard label="Students enrolled" value={totalStudents} icon={Users} />
            <StatCard label="Avg NPS" value={avgNps} icon={Sparkles} />
            <StatCard
              label="Pending payouts"
              value={`€${pendingPayout.total.toLocaleString()}`}
              icon={Wallet}
              hint={`${pendingPayout.instructorCount} instructor${pendingPayout.instructorCount === 1 ? "" : "s"}`}
            />
          </>
        )}
      </div>

      {role === "instructor" ? (
        nextUp && (
          <Card>
            <CardHeader><CardTitle className="text-base">Next up</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{nextUp.t.name} <span className="text-muted-foreground font-normal">· {nextUp.t.client}</span></p>
                <p className="mt-0.5 text-sm text-muted-foreground">{nextUp.s.date} · {nextUp.s.start_time}–{nextUp.s.end_time} · {nextUp.s.venue}</p>
              </div>
              <Button asChild><Link to="/trainings/$id" params={{ id: nextUp.t.id }}>Take attendance</Link></Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Trainings delivered</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {hasAnyDelivery ? (
                <div className="flex h-40 items-end gap-3">
                  {monthlyDelivery.map((m, i) => (
                    <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t ring-1 ring-inset ring-black/5"
                        style={{
                          height: `${Math.max(10, (m.count / maxDelivery) * 100)}%`,
                          backgroundColor:
                            i === monthlyDelivery.length - 1
                              ? "var(--primary)"
                              : i >= monthlyDelivery.length - 3
                                ? "var(--chart-3)"
                                : "var(--chart-2)",
                        }}
                        title={`${m.count} session${m.count === 1 ? "" : "s"} delivered`}
                      />
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
                  <p className="text-sm text-muted-foreground">No sessions with a past date in the last 6 months.</p>
                  <p className="text-xs text-muted-foreground">This fills in once scheduled sessions actually happen.</p>
                </div>
              )}
            </CardContent>
            <div className="border-t px-6 py-5">
              <p className="mb-3 text-sm font-medium">Instructor payouts — {monthLabel.split(" ")[0]}</p>
              {instructorPayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions delivered this month yet.</p>
              ) : (
                <div className="space-y-3">
                  {instructorPayouts.slice(0, 5).map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sessions} session{p.sessions === 1 ? "" : "s"} · €{p.payout.toLocaleString()}
                        </p>
                      </div>
                      {p.unmarked === 0 ? (
                        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Ready</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[color:var(--status-pending)]/25 px-2.5 py-0.5 text-xs font-medium text-[color:var(--status-pending-fg)]">
                          {p.unmarked} session{p.unmarked === 1 ? "" : "s"} unmarked
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  recentActivity.map((ev) => {
                    const Icon = ev.icon;
                    return (
                      <div key={ev.key} className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug">{ev.text}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(ev.time)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top clients</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trainings yet.</p>
                ) : (
                  topClients.map((c) => (
                    <div key={c.client} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.client}</span>
                      <span className="shrink-0 text-muted-foreground">{c.count} training{c.count === 1 ? "" : "s"}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: LucideIcon; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
