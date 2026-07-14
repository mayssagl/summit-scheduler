import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useAllSessions, useCreateSession, useTrainings } from "@/lib/queries";
import type { Status } from "@/lib/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_TIMEZONE = "Europe/Paris";

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
// toISOString() converts to UTC first, which shifts local midnight back a day
// in any timezone ahead of UTC (e.g. Europe/Paris) — format from local parts instead.
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarView() {
  const { role } = useAuth();
  const { data: trainings = [] } = useTrainings();
  const { data: sessions = [] } = useAllSessions();
  const createSession = useCreateSession();
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ trainingId: "", date: "", start_time: "09:00", end_time: "17:00", venue: "" });
  const canCreate = role !== "instructor";

  function openNewEvent(date?: Date) {
    if (trainings.length === 0) {
      toast.error("Create a training first — events are sessions attached to a training.");
      return;
    }
    setForm({
      trainingId: trainings[0]?.id ?? "",
      date: date ? toLocalDateStr(date) : "",
      start_time: "09:00",
      end_time: "17:00",
      venue: "",
    });
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!form.trainingId || !form.date) return;
    try {
      await createSession.mutateAsync({
        trainingId: form.trainingId,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        timezone: DEFAULT_TIMEZONE,
        venue: form.venue,
        module: "",
      });
      toast.success("Event added to calendar");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add event");
    }
  }

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
    const ds = toLocalDateStr(d);
    return trainings.filter(
      (t) =>
        sessionDatesByTraining.get(t.id)?.has(ds) ||
        (t.start_date && t.end_date && ds >= t.start_date && ds <= t.end_date),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">{role === "instructor" ? "Your assigned sessions." : "All trainings, color-coded by status."}</p>
        </div>
        {canCreate && (
          <Button onClick={() => openNewEvent()}>
            <Plus className="mr-1 h-4 w-4" />New event
          </Button>
        )}
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
                <div key={i} className={cn("group relative min-h-[88px] bg-card p-1.5", !c.date && "bg-muted/20")}>
                  {c.date && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <div className={cn("text-xs font-medium", isToday ? "inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground" : "text-muted-foreground")}>{c.date.getDate()}</div>
                        {canCreate && (
                          <button
                            type="button"
                            onClick={() => openNewEvent(c.date!)}
                            className="hidden h-4 w-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground group-hover:grid"
                            aria-label="Add event"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Training</Label>
              <Select value={form.trainingId} onValueChange={(v) => setForm({ ...form, trainingId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a training" /></SelectTrigger>
                <SelectContent>
                  {trainings.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 space-y-1.5 sm:col-span-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={!form.trainingId || !form.date || createSession.isPending}
            >
              {createSession.isPending ? "Adding…" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
