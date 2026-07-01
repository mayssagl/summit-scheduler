import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trainings/new")({ component: NewTraining });

function NewTraining() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // step 2 state
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [singles, setSingles] = useState<{ date: string; start: string; end: string; tz: string; venue: string; module: string }[]>([
    { date: "", start: "09:00", end: "17:00", tz: "Europe/Paris", venue: "", module: "" },
  ]);
  const [weeks, setWeeks] = useState(4);
  const [recurring, setRecurring] = useState<{ day: string; start: string; end: string; venue: string }[]>([
    { day: "Mon", start: "09:00", end: "12:00", venue: "" },
  ]);

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
              <Field label="Name"><Input placeholder="e.g. Negotiation Skills" /></Field>
              <Field label="Client"><Input placeholder="Acme Corp" /></Field>
              <Field label="Country">
                <Select><SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent><SelectItem value="France">France</SelectItem><SelectItem value="Germany">Germany</SelectItem><SelectItem value="UK">UK</SelectItem><SelectItem value="USA">USA</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Venue"><Input placeholder="Paris HQ" /></Field>
              <Field label="Language">
                <Select defaultValue="EN"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="EN">English</SelectItem><SelectItem value="FR">Français</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Number of students"><Input type="number" defaultValue={12} /></Field>
              <Field label="Completion threshold (%)"><Input type="number" defaultValue={70} /></Field>
              <Field label="Instructor (optional)">
                <Select><SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent><SelectItem value="i1">Jordan Lee</SelectItem><SelectItem value="i2">Sara Wells</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Start date"><Input type="date" /></Field>
              <Field label="End date"><Input type="date" /></Field>
              <Field label="Modules (optional)" className="sm:col-span-2"><Input placeholder="Comma-separated: Foundations, Tactics, Closing" /></Field>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />Linked PO / Contract</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Reference"><Input placeholder="PO-2024-921" /></Field>
                <Field label="Value"><Input type="number" placeholder="24000" /></Field>
                <Field label="Doc start"><Input type="date" /></Field>
                <Field label="Doc end"><Input type="date" /></Field>
                <Field label="Attach file" className="sm:col-span-2"><Input type="file" /></Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild><Link to="/trainings">Cancel</Link></Button>
              <Button onClick={() => setStep(2)}>Continue</Button>
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
                              <SelectContent>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
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
                  <Button>Generate sessions</Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => navigate({ to: "/trainings" })}>Create training</Button>
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