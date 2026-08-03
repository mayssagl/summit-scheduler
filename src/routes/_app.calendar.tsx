import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTrainings, type TrainingWithInstructor } from "@/lib/queries";
import type { Status } from "@/lib/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarView });

// Same underlying hue as the tinted StatusBadge pills used elsewhere, blended
// lighter than a fully-saturated fill so a whole week of stacked bars doesn't
// read as solid stripes.
const BLOCK_COLOR: Record<Status, string> = {
  Pending: "bg-[color-mix(in_oklab,var(--status-pending)_65%,white)] text-[color:var(--status-pending-fg)]",
  Scheduled: "bg-[color-mix(in_oklab,var(--status-scheduled)_65%,white)] text-[color:var(--status-scheduled-fg)]",
  Active: "bg-[color-mix(in_oklab,var(--status-active)_65%,white)] text-[color:var(--status-active-fg)]",
  Completed: "bg-[color-mix(in_oklab,var(--status-completed)_65%,white)] text-[color:var(--status-completed-fg)]",
  Cancelled: "bg-[color-mix(in_oklab,var(--status-cancelled)_65%,white)] text-[color:var(--status-cancelled-fg)]",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_LANES = 3;

function daysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
// toISOString() converts to UTC first, which shifts local midnight back a day
// in any timezone ahead of UTC (e.g. Europe/Paris) — format from local parts instead.
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en", { day: "numeric", month: "short" });
}

interface Segment {
  training: TrainingWithInstructor;
  startCol: number;
  endCol: number;
  lane: number;
  isRealStart: boolean;
  isRealEnd: boolean;
}

// Greedy interval-scheduling lane assignment: each training gets the first
// lane whose last-placed segment ends before this one starts.
function layoutWeek(weekDateStrs: string[], trainings: TrainingWithInstructor[]): { segments: Segment[]; overflowTrainings: TrainingWithInstructor[] } {
  const spans = trainings
    .filter((t) => t.start_date && t.end_date)
    .map((t) => {
      const startCol = weekDateStrs.findIndex((ds) => ds >= t.start_date! && ds <= t.end_date!);
      if (startCol === -1) return null;
      let endCol = startCol;
      for (let i = startCol; i < weekDateStrs.length; i++) {
        if (weekDateStrs[i] <= t.end_date!) endCol = i;
        else break;
      }
      return {
        training: t,
        startCol,
        endCol,
        isRealStart: weekDateStrs[startCol] === t.start_date,
        isRealEnd: weekDateStrs[endCol] === t.end_date,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.startCol - b.startCol || a.training.name.localeCompare(b.training.name));

  const laneEnds: number[] = [];
  const segments: Segment[] = [];
  const overflowTrainings: TrainingWithInstructor[] = [];
  for (const s of spans) {
    let lane = laneEnds.findIndex((end) => end < s.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endCol);
    } else {
      laneEnds[lane] = s.endCol;
    }
    if (lane >= MAX_LANES) {
      overflowTrainings.push(s.training);
      continue;
    }
    segments.push({ ...s, lane });
  }
  return { segments, overflowTrainings };
}

function CalendarView() {
  const { role, user } = useAuth();
  const { data: allTrainings = [] } = useTrainings();
  const [cursor, setCursor] = useState(new Date());
  // `new Date()` computed during the initial render can reflect the server's
  // clock/timezone (SSR) rather than the visitor's — re-derive "today" once
  // the client has actually mounted so the highlighted day is never stale.
  // Also re-anchor the viewed month to "now" on every visit to this page,
  // so browsing to a different month, navigating away, then coming back
  // always lands on the current month instead of wherever it was left.
  const [today, setToday] = useState(new Date());
  useEffect(() => {
    const now = new Date();
    setToday(now);
    setCursor(now);
  }, []);

  const trainings = useMemo(() => {
    if (role === "admin") return allTrainings;
    if (role === "delivery_manager") return allTrainings.filter((t) => t.created_by === user?.id);
    if (role === "instructor") return allTrainings.filter((t) => t.instructor_id === user?.id);
    return [];
  }, [allTrainings, role, user]);

  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0
  const totalDays = daysInMonth(cursor);
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const totalCells = Math.ceil((firstWeekday + totalDays) / 7) * 7;

  const weeks = useMemo(() => {
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === month });
    }
    const rows: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows.map((week) => {
      const weekDateStrs = week.map((c) => toLocalDateStr(c.date));
      const { segments, overflowTrainings } = layoutWeek(weekDateStrs, trainings);
      return { week, segments, overflowTrainings };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCells, gridStart.getTime(), month, trainings]);

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
  const hasAnyTrainingsThisMonth = weeks.some((w) => w.segments.length > 0 || w.overflowTrainings.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          {role === "instructor" ? "Trainings assigned to you." : role === "delivery_manager" ? "Trainings you created." : "All trainings, color-coded by status."}
        </p>
      </div>
      <Card className="overflow-hidden shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-muted/30 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {cursor.toLocaleString("en", { month: "long" })} <span className="font-normal text-muted-foreground">{year}</span>
              </CardTitle>
              {isCurrentMonth && <p className="text-xs font-medium text-primary">You're viewing the current month</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setCursor(new Date())} title={`Today: ${today.toDateString()}`}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  i >= 5 && "bg-muted/40",
                )}
              >
                {d}
              </div>
            ))}
          </div>
          {weeks.map(({ week, segments, overflowTrainings }, wi) => (
            <div key={wi} className={cn("border-b last:border-b-0", wi % 2 === 1 && "bg-muted/10")}>
              <div className="grid grid-cols-7">
                {week.map(({ date, inMonth }, i) => {
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "min-h-[44px] border-r px-2.5 pt-2 last:border-r-0",
                        !inMonth && "bg-muted/10",
                        inMonth && i >= 5 && "bg-muted/[0.06]",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-grid h-7 w-7 place-items-center rounded-full text-sm font-semibold",
                          isToday ? "bg-primary text-primary-foreground shadow-sm" : inMonth ? "text-foreground" : "text-muted-foreground/40",
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid auto-rows-[22px] grid-cols-7 gap-x-px gap-y-1.5 px-px pb-2 pt-1.5">
                {segments.map((s) => (
                  <Link
                    key={s.training.id}
                    to="/trainings/$id"
                    params={{ id: s.training.id }}
                    title={`${s.training.name} · ${s.training.client} · ${formatShort(s.training.start_date!)} – ${formatShort(s.training.end_date!)}`}
                    className={cn(
                      "flex min-w-0 items-center truncate px-2 py-1 text-xs font-medium shadow-sm transition-opacity hover:opacity-80",
                      BLOCK_COLOR[s.training.status],
                      s.isRealStart ? "rounded-l-md" : "-ml-px",
                      s.isRealEnd ? "rounded-r-md" : "-mr-px",
                    )}
                    style={{ gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`, gridRow: s.lane + 1 }}
                  >
                    <span className="truncate">{s.training.name}</span>
                  </Link>
                ))}
              </div>
              {overflowTrainings.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mx-1 mb-2 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted-foreground/20"
                    >
                      +{overflowTrainings.length} more
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-0.5">
                      {overflowTrainings.map((t) => (
                        <Link
                          key={t.id}
                          to="/trainings/$id"
                          params={{ id: t.id }}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", BLOCK_COLOR[t.status].split(" ")[0])} />
                          <span className="truncate">{t.name}</span>
                        </Link>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ))}
          {!hasAnyTrainingsThisMonth && (
            <div className="flex flex-col items-center justify-center gap-1 border-t py-10 text-center">
              <CalendarDays className="mb-1 h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No trainings scheduled in {cursor.toLocaleString("en", { month: "long" })}</p>
              <p className="text-xs text-muted-foreground">Trainings you're assigned to will show up here automatically.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t bg-muted/20 px-4 py-3 text-xs">
            {(["Pending", "Scheduled", "Active", "Completed", "Cancelled"] as Status[]).map((s) => (
              <span key={s} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium", BLOCK_COLOR[s])}>
                {s}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
