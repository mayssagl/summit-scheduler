import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RoleRoute } from "@/components/role-route";
import { useAuth } from "@/lib/auth";
import { useCreateTrainingWithSessions, useProfilesByRole, type NewSessionInput } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trainings/new")({
  component: () => (
    <RoleRoute allowed={["admin", "delivery_manager"]}>
      <NewTraining />
    </RoleRoute>
  ),
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function nextWeekdayOnOrAfter(from: Date, targetDayIndex: number) {
  const d = new Date(from);
  const currentDayIndex = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() + ((targetDayIndex - currentDayIndex + 7) % 7));
  return d;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function NewTraining() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: instructors = [] } = useProfilesByRole("instructor");
  const createTraining = useCreateTrainingWithSessions();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // step 1 state
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [country, setCountry] = useState("");
  const [venue, setVenue] = useState("");
  const [language, setLanguage] = useState<"EN" | "FR">("EN");
  const [numStudents, setNumStudents] = useState(12);
  const [completionThreshold, setCompletionThreshold] = useState(70);
  const [instructorId, setInstructorId] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modulesText, setModulesText] = useState("");
  const [poRef, setPoRef] = useState("");
  const [poValue, setPoValue] = useState("");
  const [docStartDate, setDocStartDate] = useState("");
  const [docEndDate, setDocEndDate] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);

  // step 2 state
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [singles, setSingles] = useState<{ date: string; start: string; end: string; tz: string; venue: string; module: string }[]>([
    { date: "", start: "09:00", end: "17:00", tz: "Europe/Paris", venue: "", module: "" },
  ]);
  const [weeks, setWeeks] = useState(4);
  const [recurring, setRecurring] = useState<{ day: string; start: string; end: string; venue: string }[]>([
    { day: "Mon", start: "09:00", end: "12:00", venue: "" },
  ]);

  function buildSessions(): NewSessionInput[] {
    if (mode === "single") {
      return singles
        .filter((s) => s.date)
        .map((s) => ({ date: s.date, start_time: s.start, end_time: s.end, timezone: s.tz || "Europe/Paris", venue: s.venue, module: s.module }));
    }
    const anchor = startDate ? new Date(startDate) : new Date();
    const sessions: NewSessionInput[] = [];
    for (const row of recurring) {
      const dayIndex = WEEKDAYS.indexOf(row.day);
      const first = nextWeekdayOnOrAfter(anchor, dayIndex);
      for (let week = 0; week < weeks; week++) {
        const d = new Date(first);
        d.setDate(d.getDate() + week * 7);
        sessions.push({ date: iso(d), start_time: row.start, end_time: row.end, timezone: "Europe/Paris", venue: row.venue, module: "" });
      }
    }
    return sessions;
  }

  async function handleCreate() {
    if (!user) return;
    setError(null);
    try {
      const id = await createTraining.mutateAsync({
        training: {
          name,
          client,
          country,
          venue,
          language,
          num_students: numStudents,
          completion_threshold: completionThreshold,
          instructor_id: instructorId ?? null,
          start_date: startDate || null,
          end_date: endDate || null,
          modules: modulesText.split(",").map((m) => m.trim()).filter(Boolean),
          po_ref: poRef,
          po_value: poValue ? Number(poValue) : null,
          doc_start_date: docStartDate || null,
          doc_end_date: docEndDate || null,
          po_file_url: null,
          created_by: user.id,
        },
        sessions: buildSessions(),
        poFile,
      });
      toast.success("Training created");
      navigate({ to: "/trainings/$id", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create training.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/trainings"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New training</h1>
        <p className="text-sm text-muted-foreground">Step {step} of 2 — {step === 1 ? "Details" : "Schedule sessions"}</p>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Training details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input placeholder="e.g. Negotiation Skills" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Client"><Input placeholder="Acme Corp" value={client} onChange={(e) => setClient(e.target.value)} /></Field>
              <Field label="Country">
                <Select value={country} onValueChange={setCountry}><SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent><SelectItem value="France">France</SelectItem><SelectItem value="Germany">Germany</SelectItem><SelectItem value="UK">UK</SelectItem><SelectItem value="USA">USA</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Venue"><Input placeholder="Paris HQ" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
              <Field label="Language">
                <Select value={language} onValueChange={(v) => setLanguage(v as "EN" | "FR")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="EN">English</SelectItem><SelectItem value="FR">Français</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Number of students"><Input type="number" value={numStudents} onChange={(e) => setNumStudents(Number(e.target.value))} /></Field>
              <Field label="Completion threshold (%)"><Input type="number" value={completionThreshold} onChange={(e) => setCompletionThreshold(Number(e.target.value))} /></Field>
              <Field label="Instructor (optional)">
                <Select value={instructorId} onValueChange={setInstructorId}>
                  <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent>{instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="End date"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
              <Field label="Modules (optional)" className="sm:col-span-2"><Input placeholder="Comma-separated: Foundations, Tactics, Closing" value={modulesText} onChange={(e) => setModulesText(e.target.value)} /></Field>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />Linked PO / Contract</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Reference"><Input placeholder="PO-2024-921" value={poRef} onChange={(e) => setPoRef(e.target.value)} /></Field>
                <Field label="Value"><Input type="number" placeholder="24000" value={poValue} onChange={(e) => setPoValue(e.target.value)} /></Field>
                <Field label="Doc start"><Input type="date" value={docStartDate} onChange={(e) => setDocStartDate(e.target.value)} /></Field>
                <Field label="Doc end"><Input type="date" value={docEndDate} onChange={(e) => setDocEndDate(e.target.value)} /></Field>
                <Field label="Attach file" className="sm:col-span-2">
                  <Input type="file" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
                  {poFile && <p className="mt-1 text-xs text-muted-foreground">{poFile.name}</p>}
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild><Link to="/trainings">Cancel</Link></Button>
              <Button onClick={() => setStep(2)} disabled={!name || !client}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Schedule sessions</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "recurring")}>
              <TabsList>
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="space-y-3 pt-4">
                {singles.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-6">
                    <Input type="date" value={s.date} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                    <Input type="time" value={s.start} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                    <Input type="time" value={s.end} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                    <Input placeholder="Timezone" value={s.tz} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, tz: e.target.value } : x))} />
                    <Input placeholder="Venue" value={s.venue} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, venue: e.target.value } : x))} />
                    <div className="flex gap-2">
                      <Input placeholder="Module" value={s.module} onChange={(e) => setSingles(singles.map((x, j) => j === i ? { ...x, module: e.target.value } : x))} />
                      <Button variant="ghost" size="icon" onClick={() => setSingles(singles.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSingles([...singles, { date: "", start: "09:00", end: "17:00", tz: "Europe/Paris", venue: "", module: "" }])}><Plus className="mr-1 h-4 w-4" />Add session</Button>
              </TabsContent>
              <TabsContent value="recurring" className="space-y-3 pt-4">
                <div className="flex items-end gap-3">
                  <Field label="Number of weeks"><Input type="number" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-32" /></Field>
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
                            <Select value={r.day} onValueChange={(v) => setRecurring(recurring.map((x, j) => j === i ? { ...x, day: v } : x))}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2"><Input type="time" value={r.start} onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className="w-32" /></td>
                          <td className="px-3 py-2"><Input type="time" value={r.end} onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} className="w-32" /></td>
                          <td className="px-3 py-2"><Input value={r.venue} onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, venue: e.target.value } : x))} placeholder="Venue" /></td>
                          <td className="px-3 py-2"><Button variant="ghost" size="icon" onClick={() => setRecurring(recurring.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setRecurring([...recurring, { day: "Mon", start: "09:00", end: "12:00", venue: "" }])}><Plus className="mr-1 h-4 w-4" />Add row</Button>
                  <p className="self-center text-xs text-muted-foreground">{weeks * recurring.length} sessions will be generated on Create.</p>
                </div>
              </TabsContent>
            </Tabs>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleCreate} disabled={createTraining.isPending}>
                {createTraining.isPending ? "Creating…" : "Create training"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
