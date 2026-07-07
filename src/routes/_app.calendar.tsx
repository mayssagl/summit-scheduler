import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useAllSessions, useTrainings } from "@/lib/queries";
import type { Status } from "@/lib/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarView });

const STATUS_DOT: Record<Status, string> = {
  Pending: "bg-[color:var(--status-pending)]",
  Scheduled: "bg-[color:var(--status-scheduled)]",
  Active: "bg-[color:var(--status-active)]",
  Completed: "bg-[color:var(--status-completed)]",
  Cancelled: "bg-[color:var(--status-cancelled)]",
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

function CalendarView() {
  const { role } = useAuth();
  const { data: trainings = [] } = useTrainings();
  const { data: sessions = [] } = useAllSessions();
  const [cursor, setCursor] = useState(new Date());

  const sessionDatesByTraining = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of sessions) {
      if (!map.has(s.training_id)) map.set(s.training_id, new Set());
      map.get(s.training_id)!.add(s.date);
    }
    return map;
  }, [sessions]);

  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const first = startOfMonth(cursor);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon=0
  const total = daysInMonth(cursor);
  const cells: { date: Date | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });
  for (let i = 1; i <= total; i++) cells.push({ date: new Date(year, month, i) });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const blocksFor = (d: Date) => {
    const ds = d.toISOString().slice(0, 10);
    return trainings.filter(
      (t) =>
        sessionDatesByTraining.get(t.id)?.has(ds) ||
        (t.start_date && t.end_date && ds >= t.start_date && ds <= t.end_date),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">{role === "instructor" ? "Your assigned sessions." : "All trainings, color-coded by status."}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{cursor.toLocaleString("en", { month: "long", year: "numeric" })}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="bg-muted/50 px-2 py-2 text-center font-medium uppercase text-muted-foreground">{d}</div>
            ))}
            {cells.map((c, i) => {
              const isToday = c.date && c.date.toDateString() === new Date().toDateString();
              const blocks = c.date ? blocksFor(c.date) : [];
              return (
                <div key={i} className={cn("min-h-[88px] bg-card p-1.5", !c.date && "bg-muted/20")}>
                  {c.date && (
                    <>
                      <div className={cn("mb-1 text-xs font-medium", isToday ? "inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground" : "text-muted-foreground")}>{c.date.getDate()}</div>
                      <div className="space-y-1">
                        {blocks.slice(0, 3).map((t) => (
                          <Link key={t.id} to="/trainings/$id" params={{ id: t.id }} className="flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-[11px] hover:bg-muted">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[t.status])} />
                            <span className="truncate">{t.name}</span>
                          </Link>
                        ))}
                        {blocks.length > 3 && <div className="px-1.5 text-[10px] text-muted-foreground">+{blocks.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {(["Pending","Scheduled","Active","Completed","Cancelled"] as Status[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />{s}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
