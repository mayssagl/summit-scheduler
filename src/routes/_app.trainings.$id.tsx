import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import {
  useAddResource,
  useAddSession,
  useAddStudents,
  useAddTestQuestion,
  useDeleteTestQuestion,
  useGenerateGroupInsights,
  useGroupInsights,
  useIssueCertificates,
  usePublishTestAttempts,
  useSendSurveys,
  useSetAttendance,
  useSurveyQuestions,
  useSurveyResponses,
  useTestAttempts,
  useTraining,
  useTrainingAttendance,
  useTrainingCertificates,
  useTrainingResources,
  useTrainingSessions,
  useTrainingStudents,
  useTrainingTests,
  useUpdateCertificateTemplate,
  useUpdateStudentStatus,
  uploadTrainingFile,
  type GroupInsightsContent,
  type StudentRow,
  type TrainingWithInstructor,
} from "@/lib/queries";
import { downloadCertificate, downloadCertificatesBundle, downloadGroupReport } from "@/lib/export-html";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Upload, Download, Send, FileText, Check, X as XIcon, Award, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function copyShareLink(path: string) {
  const url = `${window.location.origin}${path}`;
  navigator.clipboard.writeText(url).then(
    () => toast.success("Link copied to clipboard"),
    () => toast.error("Couldn't copy link"),
  );
}

export const Route = createFileRoute("/_app/trainings/$id")({
  component: TrainingDetail,
});

const ADMIN_TABS = ["Overview","Sessions","Students","Attendance","Certificates","Surveys","Group report","Payout"] as const;
const INSTRUCTOR_TABS = ["Sessions","Students","Attendance","Tests","Resources"] as const;

function TrainingDetail() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const { data: training, isLoading } = useTraining(id);
  const tabs = role === "instructor" ? INSTRUCTOR_TABS : ADMIN_TABS;
  const [tab, setTab] = useState<string>(tabs[0]);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | undefined>(undefined);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!training) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="w-fit" asChild><Link to="/trainings"><ArrowLeft className="mr-1 h-4 w-4" />All trainings</Link></Button>
        <p className="py-16 text-center text-sm text-muted-foreground">Training not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" asChild><Link to="/trainings"><ArrowLeft className="mr-1 h-4 w-4" />All trainings</Link></Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{training.name}</h1>
              <StatusBadge status={training.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{training.client} · {training.country} · {training.language}</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="w-max">
            {tabs.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
          </TabsList>
        </div>

        {role !== "instructor" && (
          <>
            <TabsContent value="Overview"><Overview t={training} /></TabsContent>
            <TabsContent value="Certificates"><Certificates t={training} /></TabsContent>
            <TabsContent value="Surveys"><SurveysInside t={training} /></TabsContent>
            <TabsContent value="Group report"><GroupReport t={training} /></TabsContent>
            <TabsContent value="Payout"><PayoutInside t={training} /></TabsContent>
          </>
        )}

        <TabsContent value="Sessions">
          <Sessions
            t={training}
            role={role}
            onTakeAttendance={(sessionId) => {
              setAttendanceSessionId(sessionId);
              setTab("Attendance");
            }}
          />
        </TabsContent>
        <TabsContent value="Students"><Students t={training} role={role} /></TabsContent>
        <TabsContent value="Attendance">
          <Attendance
            t={training}
            editable={role === "instructor"}
            picked={attendanceSessionId}
            onPickedChange={setAttendanceSessionId}
          />
        </TabsContent>

        {role === "instructor" && (
          <>
            <TabsContent value="Tests"><Tests t={training} /></TabsContent>
            <TabsContent value="Resources"><Resources t={training} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function Overview({ t }: { t: TrainingWithInstructor }) {
  const { data: sessions = [] } = useTrainingSessions(t.id);
  const { data: students = [] } = useTrainingStudents(t.id);
  const enrolled = students.filter((s) => s.status === "Active").length;
  const initials = t.instructor_name
    ? t.instructor_name.split(" ").map((p) => p[0]).join("")
    : "—";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Instructor</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{initials}</div>
          <div><p className="font-medium">{t.instructor_name ?? "Unassigned"}</p><p className="text-xs text-muted-foreground">Lead instructor</p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Dates:</span> {t.start_date ? `${t.start_date} → ${t.end_date}` : "—"}</p>
          <p><span className="text-muted-foreground">Sessions:</span> {sessions.length}</p>
          <p><span className="text-muted-foreground">Venue:</span> {t.venue}</p>
          <p><span className="text-muted-foreground">Language:</span> {t.language}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">PO & Payout</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">PO ref:</span> {t.po_ref || "—"}</p>
          <p><span className="text-muted-foreground">PO value:</span> <span className="font-semibold">{(t.po_value ?? 0).toLocaleString()}</span></p>
          <p><span className="text-muted-foreground">Payout:</span> <span className="font-semibold">{Math.round((t.po_value ?? 0) * 0.35).toLocaleString()}</span></p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span>Enrollment</span><span className="font-medium">{enrolled}/{t.num_students}</span></div>
            <Progress value={t.num_students ? (enrolled / t.num_students) * 100 : 0} />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span>Attendance</span><span className="font-medium">{t.attendance_rate}%</span></div>
            <Progress value={t.attendance_rate} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const DEFAULT_TIMEZONE = "Europe/Paris";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function nextWeekdayOnOrAfter(from: Date, targetDayIndex: number) {
  const d = new Date(from);
  const currentDayIndex = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() + ((targetDayIndex - currentDayIndex + 7) % 7));
  return d;
}

function iso(d: Date) {
  // toISOString() converts to UTC first, which shifts local midnight back a
  // day in any timezone ahead of UTC (e.g. Europe/Paris) — use local parts.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Sessions({
  t,
  role,
  onTakeAttendance,
}: {
  t: TrainingWithInstructor;
  role: AppRole | null;
  onTakeAttendance: (sessionId: string) => void;
}) {
  const { data: sessions = [] } = useTrainingSessions(t.id);
  const addSession = useAddSession(t.id);
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [form, setForm] = useState({ date: "", start_time: "09:00", end_time: "17:00", venue: "", module: "" });
  const [weeks, setWeeks] = useState(4);
  const [recurring, setRecurring] = useState([{ day: "Mon", start: "09:00", end: "12:00", venue: "" }]);
  const [generating, setGenerating] = useState(false);

  async function handleAdd() {
    if (!form.date) return;
    await addSession.mutateAsync({ ...form, timezone: DEFAULT_TIMEZONE });
    setForm({ date: "", start_time: "09:00", end_time: "17:00", venue: "", module: "" });
  }

  async function handleGenerate() {
    const anchor = t.start_date ? new Date(t.start_date) : new Date();
    setGenerating(true);
    try {
      for (const row of recurring) {
        const dayIndex = WEEKDAYS.indexOf(row.day);
        const first = nextWeekdayOnOrAfter(anchor, dayIndex);
        for (let week = 0; week < weeks; week++) {
          const d = new Date(first);
          d.setDate(d.getDate() + week * 7);
          await addSession.mutateAsync({
            date: iso(d),
            start_time: row.start,
            end_time: row.end,
            timezone: DEFAULT_TIMEZONE,
            venue: row.venue,
            module: "",
          });
        }
      }
      toast.success(`Generated ${weeks * recurring.length} sessions`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {role !== "instructor" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Add sessions</CardTitle>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "recurring")}>
              <TabsList><TabsTrigger value="single">Single</TabsTrigger><TabsTrigger value="recurring">Recurring</TabsTrigger></TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {mode === "single" ? (
              <div className="grid gap-3 sm:grid-cols-5">
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                <Input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                <Button onClick={handleAdd} disabled={!form.date || addSession.isPending}>Add</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <div className="space-y-1.5"><Label>Number of weeks</Label><Input type="number" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-32" /></div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr><th className="px-3 py-2 text-left">Weekday</th><th className="px-3 py-2 text-left">Start</th><th className="px-3 py-2 text-left">End</th><th className="px-3 py-2 text-left">Venue</th><th /></tr>
                    </thead>
                    <tbody>
                      {recurring.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <Select value={r.day} onValueChange={(v) => setRecurring(recurring.map((x, j) => (j === i ? { ...x, day: v } : x)))}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2"><Input type="time" value={r.start} onChange={(e) => setRecurring(recurring.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="w-32" /></td>
                          <td className="px-3 py-2"><Input type="time" value={r.end} onChange={(e) => setRecurring(recurring.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="w-32" /></td>
                          <td className="px-3 py-2"><Input value={r.venue} onChange={(e) => setRecurring(recurring.map((x, j) => (j === i ? { ...x, venue: e.target.value } : x)))} placeholder="Venue" /></td>
                          <td className="px-3 py-2"><Button variant="ghost" size="icon" onClick={() => setRecurring(recurring.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setRecurring([...recurring, { day: "Mon", start: "09:00", end: "12:00", venue: "" }])}><Plus className="mr-1 h-4 w-4" />Add row</Button>
                  <Button onClick={handleGenerate} disabled={generating}>{generating ? "Generating…" : "Generate"}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No sessions scheduled yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3 text-left font-medium">Date</th><th className="px-4 py-3 text-left font-medium">Time</th><th className="px-4 py-3 text-left font-medium">Venue</th><th className="px-4 py-3 text-left font-medium">Module</th><th className="px-4 py-3 text-left font-medium">Status</th>{role === "instructor" && <th />}</tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3">{s.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.start_time} – {s.end_time}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.venue}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.module}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", s.status === "Done" ? "bg-muted text-muted-foreground ring-border" : s.status === "Today" ? "bg-primary/15 text-primary ring-primary/30" : "bg-secondary text-secondary-foreground ring-border")}>{s.status}</span></td>
                    {role === "instructor" && <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onTakeAttendance(s.id)}>Take attendance</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddStudentDialog({ trainingId }: { trainingId: string }) {
  const addStudents = useAddStudents(trainingId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await addStudents.mutateAsync([{ name, email, dept }]);
    setName(""); setEmail(""); setDept("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Department</Label><Input value={dept} onChange={(e) => setDept(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={addStudents.isPending}>Add student</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function parseStudentsCsv(text: string): { name: string; email: string; dept: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^name\s*,\s*email/i.test(line))
    .map((line) => {
      const [name = "", email = "", dept = ""] = line.split(",").map((c) => c.trim());
      return { name, email, dept };
    })
    .filter((row) => row.name && row.email);
}

function Students({ t, role }: { t: TrainingWithInstructor; role: AppRole | null }) {
  const { data: students = [] } = useTrainingStudents(t.id);
  const addStudents = useAddStudents(t.id);
  const updateStatus = useUpdateStudentStatus(t.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const active = students.filter((s) => s.status === "Active").length;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseStudentsCsv(text);
    if (rows.length > 0) await addStudents.mutateAsync(rows);
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Students <span className="ml-2 text-sm font-normal text-muted-foreground">{active} of {t.num_students}</span></CardTitle>
        {role !== "instructor" && (
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Import CSV</Button>
            <AddStudentDialog trainingId={t.id} />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Dept</th>{role === "instructor" && <th className="px-4 py-3 text-left font-medium">Attendance</th>}<th className="px-4 py-3 text-left font-medium">Status</th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.dept}</td>
                {role === "instructor" && <td className="px-4 py-3 text-muted-foreground">{s.attendance_pct}%</td>}
                <td className="px-4 py-3">
                  {role === "instructor" ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", s.status === "Active" ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-transparent" : "bg-muted text-muted-foreground ring-border")}>{s.status}</span>
                  ) : (
                    <Select value={s.status} onValueChange={(v) => updateStatus.mutate({ studentId: s.id, status: v as StudentRow["status"] })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Invited">Invited</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Dropped">Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Attendance({
  t,
  editable,
  picked,
  onPickedChange,
}: {
  t: TrainingWithInstructor;
  editable: boolean;
  picked: string | undefined;
  onPickedChange: (sessionId: string) => void;
}) {
  const { data: sessions = [] } = useTrainingSessions(t.id);
  const { data: students = [] } = useTrainingStudents(t.id);
  const { data: attendance = [] } = useTrainingAttendance(t.id);
  const setAttendance = useSetAttendance(t.id);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const a of attendance) map.set(`${a.session_id}:${a.student_id}`, a.present);
    return map;
  }, [attendance]);

  const orderedSessions = picked ? [...sessions].sort((a, b) => (a.id === picked ? -1 : b.id === picked ? 1 : 0)) : sessions;
  const visibleSessions = orderedSessions.slice(0, 5);
  const pickerValue = picked ?? sessions[0]?.id ?? "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Attendance</CardTitle>
        <Select value={pickerValue} onValueChange={onPickedChange}>
          <SelectTrigger className="w-56"><SelectValue placeholder="No sessions yet" /></SelectTrigger>
          <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.date}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                {visibleSessions.map((s) => (
                  <th key={s.id} className={cn("px-3 py-3 text-center font-medium", s.id === picked && "bg-primary/10 text-primary")}>{s.date.slice(5)}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 12).map((st) => {
                const presentCount = visibleSessions.filter((s) => attendanceMap.get(`${s.id}:${st.id}`)).length;
                const pct = visibleSessions.length ? Math.round((presentCount / visibleSessions.length) * 100) : 0;
                return (
                  <tr key={st.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{st.name}</td>
                    {visibleSessions.map((s) => {
                      const present = attendanceMap.get(`${s.id}:${st.id}`) ?? false;
                      return (
                        <td key={s.id} className="px-3 py-3 text-center">
                          {editable ? (
                            <button
                              onClick={() => setAttendance.mutate({ sessionId: s.id, studentId: st.id, present: !present })}
                              className={cn("inline-grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset", present ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-transparent" : "bg-muted text-muted-foreground ring-border")}
                            >
                              {present ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                            </button>
                          ) : present ? (
                            <Check className="mx-auto h-4 w-4 text-[color:var(--status-active-fg)]" />
                          ) : (
                            <XIcon className="mx-auto h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-medium">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Certificates({ t }: { t: TrainingWithInstructor }) {
  const { data: students = [] } = useTrainingStudents(t.id);
  const { data: certificates = [] } = useTrainingCertificates(t.id);
  const updateTemplate = useUpdateCertificateTemplate(t.id);
  const issueCertificates = useIssueCertificates(t.id);
  const [open, setOpen] = useState(false);
  const [sentence, setSentence] = useState(t.certificate_sentence);
  const [signatoryName, setSignatoryName] = useState(t.certificate_signatory_name ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const certByStudent = useMemo(() => new Map(certificates.map((c) => [c.student_id, c])), [certificates]);
  const previewName = students[0]?.name ?? "Student name";

  function toCertExport(student: StudentRow) {
    const cert = certByStudent.get(student.id);
    return {
      studentName: student.name,
      trainingName: t.name,
      sentence,
      signatoryName: signatoryName || null,
      logoUrl: t.certificate_logo_url,
      signatureUrl: t.certificate_signature_url,
      verificationId: cert ? `TO-${cert.id.slice(0, 8).toUpperCase()}` : "UNISSUED",
    };
  }

  async function handleSaveTemplate() {
    setSaving(true);
    try {
      const logoUrl = logoFile ? await uploadTrainingFile("certificates", t.id, logoFile) : t.certificate_logo_url;
      const signatureUrl = signatureFile ? await uploadTrainingFile("certificates", t.id, signatureFile) : t.certificate_signature_url;
      await updateTemplate.mutateAsync({
        certificate_sentence: sentence,
        certificate_signatory_name: signatoryName,
        certificate_logo_url: logoUrl,
        certificate_signature_url: signatureUrl,
      });
      toast.success("Certificate template saved");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueAll() {
    const eligible = students.filter((s) => s.cert_issued && !certByStudent.has(s.id));
    if (eligible.length === 0) {
      toast.info("No new certificates to issue");
      return;
    }
    setIssuing(true);
    try {
      await issueCertificates.mutateAsync(eligible.map((s) => s.id));
      toast.success(`Issued ${eligible.length} certificate(s)`);
    } finally {
      setIssuing(false);
    }
  }

  function handleDownloadAll() {
    const issued = students.filter((s) => certByStudent.has(s.id));
    if (issued.length === 0) {
      toast.info("No issued certificates to download yet");
      return;
    }
    downloadCertificatesBundle(issued.map(toCertExport), t.name);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Certificate template</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleIssueAll} disabled={issuing}>{issuing ? "Issuing…" : "Issue certificates"}</Button>
            <Button variant="outline" onClick={() => setOpen(!open)}>Personalise</Button>
            <Button onClick={handleDownloadAll}><Download className="mr-1 h-4 w-4" />Download all</Button>
          </div>
        </CardHeader>
        {open && (
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Partner logo (top-right)</Label><Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} /></div>
              <div className="space-y-1.5"><Label>Core sentence</Label><Textarea rows={4} value={sentence} onChange={(e) => setSentence(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Signatory name</Label><Input placeholder="Jane Doe, Head of L&D" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Signature image</Label><Input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)} /></div>
              </div>
              <Button onClick={handleSaveTemplate} disabled={saving}>{saving ? "Saving…" : "Save template"}</Button>
            </div>
            <div className="rounded-xl border-2 border-dashed bg-card p-8 text-center">
              <Award className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate of completion</p>
              <p className="mt-3 text-2xl font-semibold">{previewName}</p>
              <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{sentence.replace("{student_name}", previewName).replace("{training_name}", t.name)}</p>
              <div className="mt-8 flex items-end justify-between text-xs text-muted-foreground">
                <div className="text-left"><div className="mb-1 h-px w-32 bg-foreground/40" />{signatoryName || "Signatory"}</div>
                <div className="text-right">ID: TO-{t.id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3 text-left font-medium">Student</th><th className="px-4 py-3 text-left font-medium">Completion</th><th className="px-4 py-3 text-left font-medium">Certificate</th><th /></tr>
            </thead>
            <tbody>
              {students.slice(0, 10).map((s) => {
                const cert = certByStudent.get(s.id);
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.completion_pct}%</td>
                    <td className="px-4 py-3">{cert ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {cert && (
                          <Button variant="ghost" size="sm" onClick={() => copyShareLink(`/s/certificate/${cert.share_token}`)}><Copy className="mr-1 h-3.5 w-3.5" />Link</Button>
                        )}
                        <Button variant="outline" size="sm" disabled={!cert} onClick={() => downloadCertificate(toCertExport(s))}><Download className="mr-1 h-3.5 w-3.5" />PDF</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

const FREQUENCY_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Always"];

function ResponseDistributionChart({ categories, counts }: { categories: string[]; counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-24 items-end gap-2">
      {categories.map((c, i) => (
        <div key={c} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t bg-[color:var(--chart-2)]"
            style={{ height: `${Math.max(4, (counts[i] / max) * 100)}%` }}
            title={`${c}: ${counts[i]} response${counts[i] === 1 ? "" : "s"}`}
          />
          <span className="text-[10px] text-muted-foreground">{c}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({ tone, children }: { tone: "active" | "pending" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tone === "active" && "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-transparent",
        tone === "pending" && "bg-[color-mix(in_oklab,var(--status-pending)_25%,white)] text-[color:var(--status-pending-fg)] ring-transparent",
        tone === "muted" && "bg-muted text-muted-foreground ring-border",
      )}
    >
      {children}
    </span>
  );
}

function SurveyLevelPanel({ t, level, students }: { t: TrainingWithInstructor; level: "l1" | "l3"; students: StudentRow[] }) {
  const { data: questions = [] } = useSurveyQuestions(level);
  const { data: responses = [] } = useSurveyResponses(t.id, level);
  const sendSurveys = useSendSurveys(t.id);
  const [sending, setSending] = useState(false);

  const responseByStudent = useMemo(() => new Map(responses.map((r) => [r.student_id, r])), [responses]);
  const submittedCount = responses.filter((r) => r.submitted_at).length;
  const activeStudents = students.filter((s) => s.status === "Active");

  const chartQuestion = questions.find((q) => q.type === (level === "l1" ? "1-5" : "Frequency"));
  const chartCategories = level === "l1" ? ["1", "2", "3", "4", "5"] : FREQUENCY_OPTIONS;
  const chartCounts = chartCategories.map(
    (cat) => responses.filter((r) => chartQuestion && String(r.answers[chartQuestion.id]) === cat).length,
  );

  const autoSendDate = t.end_date ? new Date(new Date(t.end_date).getTime() + 30 * 24 * 60 * 60 * 1000) : null;

  async function handleSend() {
    if (activeStudents.length === 0) {
      toast.info("No active students to send to");
      return;
    }
    setSending(true);
    try {
      await sendSurveys.mutateAsync({ level, studentIds: activeStudents.map((s) => s.id) });
      toast.success(`Survey links ready for ${activeStudents.length} student(s)`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <p className="truncate text-sm text-muted-foreground">
            {questions.length === 0
              ? "No questions configured yet — add some on the Surveys page."
              : questions.map((q, i) => `Q${i + 1} ${q.en} (${q.type})`).join(" · ")}
          </p>
          {chartQuestion && <ResponseDistributionChart categories={chartCategories} counts={chartCounts} />}
        </div>
        <div className="space-y-3">
          {level === "l1" ? (
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sent on completion</p>
              <div className="mt-1.5">{t.status === "Completed" ? <Pill tone="active">Done</Pill> : <Pill tone="pending">Pending</Pill>}</div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Pill tone="muted">Auto-send: {autoSendDate ? autoSendDate.toLocaleDateString("en", { day: "2-digit", month: "short" }) : "—"}</Pill>
              {responses.length > 0 ? <Pill tone="active">Sent</Pill> : <Pill tone="pending">Scheduled</Pill>}
            </div>
          )}
          <Button onClick={handleSend} disabled={sending} className="w-full">
            <Send className="mr-1 h-4 w-4" />{sending ? "Sending…" : `Send / resend ${level.toUpperCase()}`}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {submittedCount}/{responses.length || 0} responded{level === "l1" && ` · NPS +${t.nps}`}
      </p>
      {responses.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Student</th><th className="px-4 py-2 text-left font-medium">Status</th><th /></tr></thead>
              <tbody>
                {activeStudents.map((s) => {
                  const r = responseByStudent.get(s.id);
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2">{r ? (r.submitted_at ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />) : <span className="text-muted-foreground">Not sent</span>}</td>
                      <td className="px-4 py-2 text-right">
                        {r && <Button variant="ghost" size="sm" onClick={() => copyShareLink(`/s/survey-${level}/${r.share_token}`)}><Copy className="mr-1 h-3.5 w-3.5" />Link</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function testBuildStatus(questionCount: number, attemptCount: number): "Not built" | "Draft" | "Published" {
  if (questionCount === 0) return "Not built";
  if (attemptCount === 0) return "Draft";
  return "Published";
}

function buildStatusTone(status: string): "active" | "pending" | "muted" {
  if (status === "Published") return "active";
  if (status === "Draft") return "pending";
  return "muted";
}

function SurveysInside({ t }: { t: TrainingWithInstructor }) {
  const [sub, setSub] = useState("l1");
  const { data: students = [] } = useTrainingStudents(t.id);
  const { data: preQuestions = [] } = useTrainingTests(t.id, "pre");
  const { data: postQuestions = [] } = useTrainingTests(t.id, "post");
  const { data: preAttempts = [] } = useTestAttempts(t.id, "pre");
  const { data: postAttempts = [] } = useTestAttempts(t.id, "post");
  const preDone = preAttempts.filter((a) => a.submitted_at).length;
  const postDone = postAttempts.filter((a) => a.submitted_at).length;
  const activeCount = students.filter((s) => s.status === "Active").length;

  const moduleScores = useMemo(() => {
    const buckets = new Map<string, { preCorrect: number; preTotal: number; postCorrect: number; postTotal: number }>();
    for (const attempt of [...preAttempts, ...postAttempts]) {
      if (!attempt.submitted_at) continue;
      const phaseTests = attempt.phase === "pre" ? preQuestions : postQuestions;
      for (const q of phaseTests) {
        const key = q.module?.trim() || "Overall";
        if (!buckets.has(key)) buckets.set(key, { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0 });
        const b = buckets.get(key)!;
        const isCorrect = attempt.answers?.[q.id] !== undefined && attempt.answers[q.id] === q.correct_option;
        if (attempt.phase === "pre") {
          b.preTotal += 1;
          if (isCorrect) b.preCorrect += 1;
        } else {
          b.postTotal += 1;
          if (isCorrect) b.postCorrect += 1;
        }
      }
    }
    return Array.from(buckets.entries()).map(([module, b]) => {
      const pre = b.preTotal > 0 ? Math.round((b.preCorrect / b.preTotal) * 100) : null;
      const post = b.postTotal > 0 ? Math.round((b.postCorrect / b.postTotal) * 100) : null;
      return { module, pre, post, gain: pre !== null && post !== null ? post - pre : null };
    });
  }, [preAttempts, postAttempts, preQuestions, postQuestions]);

  const preStatus = testBuildStatus(preQuestions.length, preAttempts.length);
  const postStatus = testBuildStatus(postQuestions.length, postAttempts.length);

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList><TabsTrigger value="l1">L1 Satisfaction</TabsTrigger><TabsTrigger value="l2">L2 Learning</TabsTrigger><TabsTrigger value="l3">L3 Behaviour</TabsTrigger></TabsList>
          <TabsContent value="l1"><SurveyLevelPanel t={t} level="l1" students={students} /></TabsContent>
          <TabsContent value="l2" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Pre:</span>
              <Pill tone={buildStatusTone(preStatus)}>{preStatus}</Pill>
              <span className="text-muted-foreground">Post:</span>
              <Pill tone={buildStatusTone(postStatus)}>{postStatus}</Pill>
              <span className="text-xs text-muted-foreground">— built by the instructor</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Avg learning gain" value={`+${t.learning_gain}%`} />
              <StatTile label="Questions / test" value={Math.max(preQuestions.length, postQuestions.length)} />
              <StatTile label="Completed post" value={`${postDone}/${activeCount}`} />
            </div>
            {moduleScores.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Per-skill mastery (post)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr><th className="px-4 py-2 text-left font-medium">Module</th><th className="px-4 py-2 text-left font-medium">Pre</th><th className="px-4 py-2 text-left font-medium">Post</th><th className="px-4 py-2 text-left font-medium">Gain</th></tr>
                    </thead>
                    <tbody>
                      {moduleScores.map((m, i) => (
                        <tr key={m.module} className="border-t">
                          <td className="px-4 py-2 font-medium">{i + 1}. {m.module}</td>
                          <td className="px-4 py-2 text-muted-foreground">{m.pre !== null ? `${m.pre}%` : "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{m.post !== null ? `${m.post}%` : "—"}</td>
                          <td className="px-4 py-2 font-medium">{m.gain !== null ? `${m.gain >= 0 ? "+" : ""}${m.gain}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
            <p className="text-xs text-muted-foreground">Admin &amp; DM can see whether the pre/post tests are built (not built / draft / published).</p>
          </TabsContent>
          <TabsContent value="l3"><SurveyLevelPanel t={t} level="l3" students={students} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function insightCards(content: GroupInsightsContent) {
  return [
    { title: "Strengths", body: content.strengths.map((s) => `• ${s}`).join("\n") },
    { title: "Shared gap", body: content.shared_gap },
    { title: "Recommended next training", body: content.recommended_next_training },
    { title: "Account-manager talking points", body: content.talking_points.map((s) => `• ${s}`).join("\n") },
  ];
}

function GroupReport({ t }: { t: TrainingWithInstructor }) {
  const { data: existing, isLoading } = useGroupInsights(t.id);
  const generate = useGenerateGroupInsights(t.id);

  const content = generate.data ?? existing?.content ?? null;

  async function handleGenerate() {
    try {
      await generate.mutateAsync();
      toast.success("Group insights generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate insights.");
    }
  }

  function handleDownload() {
    if (!content) return;
    downloadGroupReport({
      trainingName: t.name,
      attendanceRate: t.attendance_rate,
      learningGain: t.learning_gain,
      nps: t.nps,
      insights: insightCards(content),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? "Generating…" : existing ? "Regenerate insights" : "Generate insights"}
        </Button>
        <Button onClick={handleDownload} disabled={!content}><Download className="mr-1 h-4 w-4" />Download PDF</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Attendance" value={`${t.attendance_rate}%`} />
        <StatTile label="Learning gain" value={`+${t.learning_gain}%`} />
        <StatTile label="NPS" value={t.nps} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Group insights</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !content ? (
            <p className="text-sm text-muted-foreground lg:col-span-2">
              No insights generated yet — click "Generate insights" to have AI summarise this cohort's attendance, test
              results, and survey feedback.
            </p>
          ) : (
            insightCards(content).map((c) => (
              <Card key={c.title}>
                <CardHeader><CardTitle className="text-sm">{c.title}</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{c.body}</p></CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutInside({ t }: { t: TrainingWithInstructor }) {
  const { data: sessions = [] } = useTrainingSessions(t.id);
  const sessionsDone = sessions.filter((s) => s.status === "Done").length;
  const rate = 450;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Payout</CardTitle>
        <p className="text-sm text-muted-foreground">PO value <span className="ml-2 font-semibold text-foreground">{(t.po_value ?? 0).toLocaleString()}</span></p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Instructor</th><th className="px-4 py-3 text-left font-medium">Sessions delivered</th><th className="px-4 py-3 text-left font-medium">Rate</th><th className="px-4 py-3 text-left font-medium">Payout</th></tr></thead>
          <tbody><tr className="border-t"><td className="px-4 py-3 font-medium">{t.instructor_name ?? "Unassigned"}</td><td className="px-4 py-3">{sessionsDone}</td><td className="px-4 py-3">{rate}</td><td className="px-4 py-3 font-semibold">{(sessionsDone * rate).toLocaleString()}</td></tr></tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

function Tests({ t }: { t: TrainingWithInstructor }) {
  const [phase, setPhase] = useState<"pre" | "post">("pre");
  const { data: questions = [] } = useTrainingTests(t.id, phase);
  const { data: students = [] } = useTrainingStudents(t.id);
  const { data: attempts = [] } = useTestAttempts(t.id, phase);
  const addQuestion = useAddTestQuestion(t.id);
  const deleteQuestion = useDeleteTestQuestion(t.id, phase);
  const publish = usePublishTestAttempts(t.id);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [module, setModule] = useState<string>(t.modules[0] ?? "");
  const [publishing, setPublishing] = useState(false);

  async function handleAddQuestion() {
    if (!question || options.some((o) => !o)) {
      toast.error("Fill in the question and all four options");
      return;
    }
    await addQuestion.mutateAsync({
      phase,
      question,
      options: OPTION_LETTERS.map((label, i) => ({ label, text: options[i] })),
      correct_option: OPTION_LETTERS[correctIndex],
      module: module || null,
      position: questions.length,
    });
    setQuestion("");
    setOptions(["", "", "", ""]);
    setCorrectIndex(0);
    toast.success("Question added");
  }

  async function handlePublish() {
    const activeStudents = students.filter((s) => s.status === "Active");
    if (activeStudents.length === 0) {
      toast.info("No active students to publish to");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question before publishing");
      return;
    }
    setPublishing(true);
    try {
      await publish.mutateAsync({ phase, studentIds: activeStudents.map((s) => s.id) });
      toast.success(`Test links ready for ${activeStudents.length} student(s)`);
    } finally {
      setPublishing(false);
    }
  }

  const activeStudents = students.filter((s) => s.status === "Active");
  const attemptByStudent = useMemo(() => new Map(attempts.map((a) => [a.student_id, a])), [attempts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={phase} onValueChange={(v) => setPhase(v as "pre" | "post")}><TabsList><TabsTrigger value="pre">Pre-test</TabsTrigger><TabsTrigger value="post">Post-test</TabsTrigger></TabsList></Tabs>
        <span className="text-sm text-muted-foreground">{questions.length} question(s)</span>
      </div>

      {questions.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-0">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium">{i + 1}. {q.question} {q.module && <span className="font-normal text-muted-foreground">· {q.module}</span>}</p>
                  <p className="text-xs text-muted-foreground">{q.options.map((o) => `${o.label}. ${o.text}`).join(" · ")} — correct: {q.correct_option}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteQuestion.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5"><Label>Question</Label><Textarea rows={2} placeholder="Write the question…" value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Module (optional)</Label>
            {t.modules.length > 0 ? (
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger className="sm:w-64"><SelectValue placeholder="No module" /></SelectTrigger>
                <SelectContent>{t.modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input className="sm:w-64" placeholder="e.g. Framing" value={module} onChange={(e) => setModule(e.target.value)} />
            )}
          </div>
          <div className="space-y-3">
            {OPTION_LETTERS.map((l, i) => (
              <div key={l} className="flex items-center gap-3 rounded-md border p-3">
                <input type="radio" name="correct" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} className="h-4 w-4 accent-[color:var(--primary)]" />
                <span className="font-semibold">{l}.</span>
                <Input
                  placeholder={`Option ${l}`}
                  className="border-0 shadow-none focus-visible:ring-0"
                  value={options[i]}
                  onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleAddQuestion} disabled={addQuestion.isPending}><Plus className="mr-1 h-4 w-4" />Add question</Button>
            <Button onClick={handlePublish} disabled={publishing}>{publishing ? "Publishing…" : "Publish & send"}</Button>
          </div>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Student</th><th className="px-4 py-2 text-left font-medium">Status</th><th className="px-4 py-2 text-left font-medium">Score</th><th /></tr></thead>
              <tbody>
                {activeStudents.map((s) => {
                  const a = attemptByStudent.get(s.id);
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2">{a ? (a.submitted_at ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />) : <span className="text-muted-foreground">Not sent</span>}</td>
                      <td className="px-4 py-2">{a?.score != null ? `${a.score}%` : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {a && <Button variant="ghost" size="sm" onClick={() => copyShareLink(`/s/test/${a.share_token}`)}><Copy className="mr-1 h-3.5 w-3.5" />Link</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Resources({ t }: { t: TrainingWithInstructor }) {
  const { data: resources = [] } = useTrainingResources(t.id);
  const addResource = useAddResource(t.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await addResource.mutateAsync({ file, scope: "Whole training" });
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-32 w-full place-items-center rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/30"
          >
            <div className="text-center"><Upload className="mx-auto mb-2 h-6 w-6" />{addResource.isPending ? "Uploading…" : "Click to upload a file"}</div>
          </button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">File</th><th className="px-4 py-3 text-left font-medium">Attached to</th><th className="px-4 py-3 text-left font-medium">Version</th></tr></thead>
            <tbody>
              {resources.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">No files uploaded yet.</td></tr>
              ) : (
                resources.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="px-4 py-3 font-medium"><a href={f.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline"><FileText className="h-4 w-4 text-muted-foreground" />{f.name}</a></td>
                    <td className="px-4 py-3 text-muted-foreground">{f.scope}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>
  );
}
