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
import { ArrowLeft, ArrowRight, FileText, Plus, Trash2, Upload } from "lucide-react";
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
  // toISOString() converts to UTC first, which shifts local midnight back a
  // day in any timezone ahead of UTC (e.g. Europe/Paris) — use local parts.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthShort(dateStr: string) {
  return new Date(dateStr).toLocaleString("en", { month: "short" });
}

function formatSessionDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${new Date(y, m - 1, d).toLocaleString("en", { month: "short" })}`;
}

type VenueValue = { type: "entreprise" | "gomycode" | "autre"; detail: string };
const emptyVenue: VenueValue = { type: "entreprise", detail: "" };

function formatVenue(v: VenueValue) {
  if (v.type === "gomycode") return v.detail ? `Chez GoMyCode – ${v.detail}` : "Chez GoMyCode";
  if (v.type === "autre") return v.detail || "Autre";
  return "Chez entreprise";
}

function VenueField({ value, onChange }: { value: VenueValue; onChange: (v: VenueValue) => void }) {
  return (
    <div className="space-y-2">
      <Select value={value.type} onValueChange={(t) => onChange({ type: t as VenueValue["type"], detail: "" })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="entreprise">Chez entreprise</SelectItem>
          <SelectItem value="gomycode">Chez GoMyCode</SelectItem>
          <SelectItem value="autre">Autre</SelectItem>
        </SelectContent>
      </Select>
      {value.type === "gomycode" && (
        <Input placeholder="Préciser le hackerspace" value={value.detail} onChange={(e) => onChange({ ...value, detail: e.target.value })} />
      )}
      {value.type === "autre" && (
        <Input placeholder="Préciser le lieu" value={value.detail} onChange={(e) => onChange({ ...value, detail: e.target.value })} />
      )}
    </div>
  );
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
  const [docType, setDocType] = useState<"po" | "contract">("po");
  const [poRef, setPoRef] = useState("");
  const [poValue, setPoValue] = useState("");
  const [docStartDate, setDocStartDate] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [savingPending, setSavingPending] = useState(false);

  // step 2 state
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [singleForm, setSingleForm] = useState<{ date: string; start: string; end: string; tz: string; venue: VenueValue; module: string }>({
    date: "", start: "09:00", end: "13:00", tz: "Europe/Paris", venue: emptyVenue, module: "",
  });
  const [singles, setSingles] = useState<typeof singleForm[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dateError, setDateError] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [recurring, setRecurring] = useState<{ day: string; start: string; end: string; venue: VenueValue }[]>([
    { day: "Mon", start: "09:00", end: "12:00", venue: emptyVenue },
  ]);

  function handleAddSingle() {
    if (!singleForm.date) {
      setDateError(true);
      return;
    }
    setDateError(false);
    if (editingIndex !== null) {
      setSingles(singles.map((s, i) => (i === editingIndex ? singleForm : s)));
      setEditingIndex(null);
    } else {
      setSingles([...singles, singleForm]);
    }
    setSingleForm({ ...singleForm, date: "", module: "" });
  }

  function handleEditSingle(i: number) {
    setSingleForm(singles[i]);
    setEditingIndex(i);
  }

  function buildSessions(): NewSessionInput[] {
    if (mode === "single") {
      return singles
        .filter((s) => s.date)
        .map((s) => ({ date: s.date, start_time: s.start, end_time: s.end, timezone: s.tz || "Europe/Paris", venue: formatVenue(s.venue), module: s.module }));
    }
    const anchor = startDate ? new Date(startDate) : new Date();
    const sessions: NewSessionInput[] = [];
    for (const row of recurring) {
      const dayIndex = WEEKDAYS.indexOf(row.day);
      const first = nextWeekdayOnOrAfter(anchor, dayIndex);
      for (let week = 0; week < weeks; week++) {
        const d = new Date(first);
        d.setDate(d.getDate() + week * 7);
        sessions.push({ date: iso(d), start_time: row.start, end_time: row.end, timezone: "Europe/Paris", venue: formatVenue(row.venue), module: "" });
      }
    }
    return sessions;
  }

  function buildTrainingInput(userId: string) {
    return {
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
      po_file_url: null,
      created_by: userId,
    };
  }

  async function handleCreate() {
    if (!user) return;
    setError(null);
    try {
      const id = await createTraining.mutateAsync({
        training: buildTrainingInput(user.id),
        sessions: buildSessions(),
        poFile,
      });
      toast.success("Training created");
      navigate({ to: "/trainings/$id", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create training.");
    }
  }

  async function handleSaveAsPending() {
    if (!user) return;
    setError(null);
    setSavingPending(true);
    try {
      const id = await createTraining.mutateAsync({
        training: buildTrainingInput(user.id),
        sessions: [],
        poFile,
      });
      toast.success("Training saved as Pending");
      navigate({ to: "/trainings/$id", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create training.");
    } finally {
      setSavingPending(false);
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
                  <SelectContent><SelectItem value="Tunisia">Tunisia</SelectItem><SelectItem value="Algeria">Algeria</SelectItem><SelectItem value="Saudi Arabia">Saudi Arabia</SelectItem><SelectItem value="Senegal">Senegal</SelectItem><SelectItem value="Morocco">Morocco</SelectItem><SelectItem value="Kenya">Kenya</SelectItem><SelectItem value="Canary Islands">Canary Islands</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Training venue"><Input placeholder="Paris HQ" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
              <Field label="Training language">
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
              <Field label="Training start date">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
              </Field>
              <Field label="Training end date">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
              </Field>
              <Field label="Training modules (optional)" className="sm:col-span-2"><Input placeholder="Comma-separated: Foundations, Tactics, Closing" value={modulesText} onChange={(e) => setModulesText(e.target.value)} /></Field>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />PO or contract</div>

              <div className="mb-4 flex flex-wrap gap-2">
                <DocPill active={docType === "po"} onClick={() => setDocType("po")}>PO</DocPill>
                <DocPill active={docType === "contract"} onClick={() => setDocType("contract")}>Contract</DocPill>
                <DocPill active={showAttach} icon={<Upload className="h-3 w-3" />} onClick={() => setShowAttach((v) => !v)}>Attach file</DocPill>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Reference">
                  <Input placeholder={docType === "po" ? "PO-2024-921" : "CTR-2024-921"} value={poRef} onChange={(e) => setPoRef(e.target.value)} />
                </Field>
                <Field label="Value"><Input type="number" placeholder="24000" value={poValue} onChange={(e) => setPoValue(e.target.value)} /></Field>
                <Field label="Dates">
                  <Input
                    readOnly
                    disabled
                    className="text-muted-foreground"
                    value={
                      startDate && endDate
                        ? monthShort(startDate) === monthShort(endDate)
                          ? monthShort(startDate)
                          : `${monthShort(startDate)}–${monthShort(endDate)}`
                        : "Not set"
                    }
                  />
                </Field>
              </div>

              {showAttach && (
                <div className="mt-3">
                  <Field label="Attach file">
                    <Input type="file" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
                    {poFile && <p className="mt-1 text-xs text-muted-foreground">{poFile.name}</p>}
                  </Field>
                </div>
              )}

              <div className="mt-3">
                <Field label="Contract signature date">
                  <Input type="date" value={docStartDate} onChange={(e) => setDocStartDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
                </Field>
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={handleSaveAsPending} disabled={!name || !client || savingPending}>
                {savingPending ? "Saving…" : "Save as Pending"}
              </Button>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" asChild><Link to="/trainings">Cancel</Link></Button>
                <Button onClick={() => setStep(2)} disabled={!name || !client}>
                  Save & add sessions<ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
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
              <TabsContent value="single" className="space-y-5 pt-4">
                <div>
                  <p className="mb-3 text-sm font-medium">Add a session</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <Field label="Date">
                      <Input
                        type="date"
                        value={singleForm.date}
                        onChange={(e) => { setSingleForm({ ...singleForm, date: e.target.value }); setDateError(false); }}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className={dateError ? "border-destructive" : undefined}
                      />
                      {dateError && <p className="mt-1 text-xs text-destructive">Pick a date first.</p>}
                    </Field>
                    <Field label="Start – End" className="sm:col-span-2">
                      <div className="flex gap-1">
                        <Input type="time" value={singleForm.start} onChange={(e) => setSingleForm({ ...singleForm, start: e.target.value })} />
                        <Input type="time" value={singleForm.end} onChange={(e) => setSingleForm({ ...singleForm, end: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Timezone">
                      <Input placeholder="Timezone" value={singleForm.tz} onChange={(e) => setSingleForm({ ...singleForm, tz: e.target.value })} />
                    </Field>
                    <Field label="Venue">
                      <VenueField value={singleForm.venue} onChange={(v) => setSingleForm({ ...singleForm, venue: v })} />
                    </Field>
                    <Field label="Module (optional)">
                      <Input placeholder="Module" value={singleForm.module} onChange={(e) => setSingleForm({ ...singleForm, module: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Sessions are added one at a time.</p>
                    <Button variant="outline" size="sm" onClick={handleAddSingle}>
                      <Plus className="mr-1 h-4 w-4" />{editingIndex !== null ? "Update session" : "Add session"}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Sessions added ({singles.length})</p>
                  {singles.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No sessions added yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Time</th>
                            <th className="px-3 py-2 text-left">Venue</th>
                            <th className="px-3 py-2 text-left">Module</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {singles.map((s, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2">{formatSessionDate(s.date)}</td>
                              <td className="px-3 py-2">{s.start}–{s.end}</td>
                              <td className="px-3 py-2">{formatVenue(s.venue)}</td>
                              <td className="px-3 py-2">{s.module || "—"}</td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1">
                                  <Button variant="outline" size="sm" onClick={() => handleEditSingle(i)}>Edit</Button>
                                  <Button variant="ghost" size="icon" onClick={() => setSingles(singles.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
                          <td className="px-3 py-2"><VenueField value={r.venue} onChange={(v) => setRecurring(recurring.map((x, j) => j === i ? { ...x, venue: v } : x))} /></td>
                          <td className="px-3 py-2"><Button variant="ghost" size="icon" onClick={() => setRecurring(recurring.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => setRecurring([...recurring, { day: "Mon", start: "09:00", end: "12:00", venue: emptyVenue }])}><Plus className="mr-1 h-4 w-4" />Add row</Button>
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

function DocPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary text-primary" : "border-input text-muted-foreground hover:text-foreground",
      )}
    >
      {icon ?? <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />}
      {children}
    </button>
  );
}
