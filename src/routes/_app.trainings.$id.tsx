import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useRole } from "@/lib/role";
import { getTraining, type Training } from "@/lib/mock";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Upload, Download, Send, FileText, Check, X as XIcon, Award } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trainings/$id")({
  loader: ({ params }) => {
    const t = getTraining(params.id);
    if (!t) throw notFound();
    return { training: t };
  },
  component: TrainingDetail,
});

const ADMIN_TABS = ["Overview","Sessions","Students","Attendance","Certificates","Surveys","Group report","Payout"] as const;
const INSTRUCTOR_TABS = ["Sessions","Students","Attendance","Tests","Resources"] as const;

function TrainingDetail() {
  const { training } = Route.useLoaderData();
  const { role } = useRole();
  const tabs = role === "instructor" ? INSTRUCTOR_TABS : ADMIN_TABS;
  const [tab, setTab] = useState<string>(tabs[0]);

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

        <TabsContent value="Sessions"><Sessions t={training} /></TabsContent>
        <TabsContent value="Students"><Students t={training} /></TabsContent>
        <TabsContent value="Attendance"><Attendance t={training} editable={role === "instructor"} /></TabsContent>

        {role === "instructor" && (
          <>
            <TabsContent value="Tests"><Tests /></TabsContent>
            <TabsContent value="Resources"><Resources /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function Overview({ t }: { t: Training }) {
  const enrolled = t.students.filter((s) => s.status === "Active").length;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Instructor</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{t.instructor.split(" ").map((p) => p[0]).join("")}</div>
          <div><p className="font-medium">{t.instructor}</p><p className="text-xs text-muted-foreground">Lead instructor</p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Dates:</span> {t.startDate ? `${t.startDate} → ${t.endDate}` : "—"}</p>
          <p><span className="text-muted-foreground">Sessions:</span> {t.sessions.length}</p>
          <p><span className="text-muted-foreground">Venue:</span> {t.venue}</p>
          <p><span className="text-muted-foreground">Language:</span> {t.language}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">PO & Payout</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">PO ref:</span> {t.poRef}</p>
          <p><span className="text-muted-foreground">PO value:</span> <span className="font-semibold">{t.poValue.toLocaleString()}</span></p>
          <p><span className="text-muted-foreground">Payout:</span> <span className="font-semibold">{Math.round(t.poValue * 0.35).toLocaleString()}</span></p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span>Enrollment</span><span className="font-medium">{enrolled}/{t.numStudents}</span></div>
            <Progress value={(enrolled / t.numStudents) * 100} />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-sm"><span>Attendance</span><span className="font-medium">{t.attendanceRate}%</span></div>
            <Progress value={t.attendanceRate} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Sessions({ t }: { t: Training }) {
  const { role } = useRole();
  const [mode, setMode] = useState<"single" | "recurring">("single");
  return (
    <div className="space-y-4">
      {role !== "instructor" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Add sessions</CardTitle>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList><TabsTrigger value="single">Single</TabsTrigger><TabsTrigger value="recurring">Recurring</TabsTrigger></TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            {mode === "single" ? (
              <>
                <Input type="date" /><Input type="time" defaultValue="09:00" /><Input type="time" defaultValue="17:00" /><Input placeholder="Venue" /><Button>Add</Button>
              </>
            ) : (
              <>
                <Input type="number" placeholder="Weeks" defaultValue={4} className="sm:col-span-1" />
                <p className="text-sm text-muted-foreground sm:col-span-3">Configure weekday rows below.</p>
                <Button>Generate</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {t.sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No sessions scheduled yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3 text-left font-medium">Date</th><th className="px-4 py-3 text-left font-medium">Time</th><th className="px-4 py-3 text-left font-medium">Venue</th><th className="px-4 py-3 text-left font-medium">Module</th><th className="px-4 py-3 text-left font-medium">Status</th>{role === "instructor" && <th />}</tr>
              </thead>
              <tbody>
                {t.sessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3">{s.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.start} – {s.end}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.venue}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.module}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", s.status === "Done" ? "bg-muted text-muted-foreground ring-border" : s.status === "Today" ? "bg-primary/15 text-primary ring-primary/30" : "bg-secondary text-secondary-foreground ring-border")}>{s.status}</span></td>
                    {role === "instructor" && <td className="px-4 py-3 text-right"><Button size="sm" variant="outline">Take attendance</Button></td>}
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

function Students({ t }: { t: Training }) {
  const { role } = useRole();
  const active = t.students.filter((s) => s.status === "Active").length;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Students <span className="ml-2 text-sm font-normal text-muted-foreground">{active} of {t.numStudents}</span></CardTitle>
        {role !== "instructor" && (
          <div className="flex gap-2"><Button variant="outline" size="sm"><Upload className="mr-1 h-4 w-4" />Import CSV</Button><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add</Button></div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left font-medium">Name</th><th className="px-4 py-3 text-left font-medium">Email</th><th className="px-4 py-3 text-left font-medium">Dept</th>{role === "instructor" && <th className="px-4 py-3 text-left font-medium">Attendance</th>}<th className="px-4 py-3 text-left font-medium">Status</th></tr>
          </thead>
          <tbody>
            {t.students.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.dept}</td>
                {role === "instructor" && <td className="px-4 py-3 text-muted-foreground">{s.attendance}%</td>}
                <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", s.status === "Active" ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-transparent" : "bg-muted text-muted-foreground ring-border")}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Attendance({ t, editable }: { t: Training; editable: boolean }) {
  const sessions = t.sessions.length ? t.sessions : [{ id: "demo", date: "—" } as any];
  const [picked, setPicked] = useState(sessions[0].id);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Attendance</CardTitle>
        <Select value={picked} onValueChange={setPicked}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.date}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                {t.sessions.slice(0, 5).map((s) => <th key={s.id} className="px-3 py-3 text-center font-medium">{s.date.slice(5)}</th>)}
                <th className="px-4 py-3 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {t.students.slice(0, 12).map((st) => (
                <tr key={st.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{st.name}</td>
                  {t.sessions.slice(0, 5).map((s, i) => {
                    const present = (st.id.charCodeAt(2) + i) % 5 !== 0;
                    return <td key={s.id} className="px-3 py-3 text-center">
                      {editable ? (
                        <button className={cn("inline-grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset", present ? "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-transparent" : "bg-muted text-muted-foreground ring-border")}>
                          {present ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        present ? <Check className="mx-auto h-4 w-4 text-[color:var(--status-active-fg)]" /> : <XIcon className="mx-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </td>;
                  })}
                  <td className="px-4 py-3 text-right font-medium">{st.attendance}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Certificates({ t }: { t: Training }) {
  const [open, setOpen] = useState(false);
  const [sentence, setSentence] = useState("This certifies that {student_name} has successfully completed {training_name}.");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Certificate template</CardTitle>
          <div className="flex gap-2">
            <Select defaultValue="standard">
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="branded">Co-branded</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setOpen(!open)}>Personalise</Button>
            <Button><Download className="mr-1 h-4 w-4" />Download all (ZIP)</Button>
          </div>
        </CardHeader>
        {open && (
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Partner logo (top-right)</Label><Input type="file" /></div>
              <div className="space-y-1.5"><Label>Core sentence</Label><Textarea rows={4} value={sentence} onChange={(e) => setSentence(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Signatory name</Label><Input placeholder="Jane Doe, Head of L&D" /></div>
                <div className="space-y-1.5"><Label>Signature image</Label><Input type="file" /></div>
              </div>
            </div>
            <div className="rounded-xl border-2 border-dashed bg-card p-8 text-center">
              <Award className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate of completion</p>
              <p className="mt-3 text-2xl font-semibold">Emma Chen</p>
              <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{sentence.replace("{student_name}", "Emma Chen").replace("{training_name}", t.name)}</p>
              <div className="mt-8 flex items-end justify-between text-xs text-muted-foreground">
                <div className="text-left"><div className="mb-1 h-px w-32 bg-foreground/40" />Signatory</div>
                <div className="text-right">ID: TO-2024-{t.id.toUpperCase()}-01</div>
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
              {t.students.slice(0, 10).map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.completion}%</td>
                  <td className="px-4 py-3">{s.certIssued ? <StatusBadge status="Completed" /> : <StatusBadge status="Pending" />}</td>
                  <td className="px-4 py-3 text-right"><Button variant="outline" size="sm"><Download className="mr-1 h-3.5 w-3.5" />PDF</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SurveysInside({ t }: { t: Training }) {
  const [sub, setSub] = useState("l1");
  const data = [
    { name: "1", v: 1 },{ name: "2", v: 2 },{ name: "3", v: 4 },{ name: "4", v: 8 },{ name: "5", v: 12 },
  ];
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList><TabsTrigger value="l1">L1 Satisfaction</TabsTrigger><TabsTrigger value="l2">L2 Learning</TabsTrigger><TabsTrigger value="l3">L3 Behaviour</TabsTrigger></TabsList>
          <TabsContent value="l1" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Responses" value={`${Math.round(t.numStudents * t.surveyRate / 100)}/${t.numStudents}`} />
              <StatTile label="NPS" value={t.nps} />
              <StatTile label="Avg score" value="4.4" />
            </div>
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="v" fill="oklch(0.72 0.17 55)" /></BarChart></ResponsiveContainer></div>
            <Button><Send className="mr-1 h-4 w-4" />Send / resend</Button>
          </TabsContent>
          <TabsContent value="l2" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatTile label="Pre-test" value={<StatusBadge status="Completed" />} />
              <StatTile label="Post-test" value={<StatusBadge status="Active" />} />
              <StatTile label="Learning gain" value={`+${t.learningGain}%`} />
              <StatTile label="Completed" value={`${Math.round(t.numStudents * 0.7)}/${t.numStudents}`} />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Module</th><th className="px-4 py-2 text-left font-medium">Pre %</th><th className="px-4 py-2 text-left font-medium">Post %</th><th className="px-4 py-2 text-left font-medium">Gain</th></tr></thead>
                <tbody>{t.modules.map((m, i) => (<tr key={m} className="border-t"><td className="px-4 py-2 font-medium">{m}</td><td className="px-4 py-2">{45 + i * 3}</td><td className="px-4 py-2">{72 + i * 4}</td><td className="px-4 py-2 text-[color:var(--status-active-fg)]">+{27 + i}%</td></tr>))}</tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="l3" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Auto-send" value="30 days after" />
              <StatTile label="Status" value={<StatusBadge status="Scheduled" />} />
            </div>
            <Card><CardContent className="space-y-2 pt-5 text-sm">
              <p>1. How often do you apply what you learned?</p>
              <p>2. Impact on your daily work?</p>
              <p>3. What blockers remain?</p>
            </CardContent></Card>
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="v" fill="oklch(0.72 0.17 55)" /></BarChart></ResponsiveContainer></div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function GroupReport({ t }: { t: Training }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button><Download className="mr-1 h-4 w-4" />Download PDF</Button></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Attendance" value={`${t.attendanceRate}%`} />
        <StatTile label="Learning gain" value={`+${t.learningGain}%`} />
        <StatTile label="NPS" value={t.nps} />
      </div>
      <Card><CardHeader><CardTitle className="text-base">Group insights</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {[
            { title: "Strengths", body: "Strong engagement during practical role-play. Group quickly adopted the new framework." },
            { title: "Shared gap", body: "Difficulty handling pushback in high-pressure scenarios." },
            { title: "Recommended next training", body: "Advanced Negotiation: Handling Conflict (2 days)." },
            { title: "Account-manager talking points", body: "Position L3 follow-up at +30 days; share NPS with sponsor." },
          ].map((c) => (
            <Card key={c.title}><CardHeader><CardTitle className="text-sm">{c.title}</CardTitle></CardHeader><CardContent><Textarea defaultValue={c.body} rows={3} /></CardContent></Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutInside({ t }: { t: Training }) {
  const sessionsDone = t.sessions.filter((s) => s.status === "Done").length;
  const rate = 450;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Payout</CardTitle>
        <p className="text-sm text-muted-foreground">PO value <span className="ml-2 font-semibold text-foreground">{t.poValue.toLocaleString()}</span></p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">Instructor</th><th className="px-4 py-3 text-left font-medium">Sessions delivered</th><th className="px-4 py-3 text-left font-medium">Rate</th><th className="px-4 py-3 text-left font-medium">Payout</th></tr></thead>
          <tbody><tr className="border-t"><td className="px-4 py-3 font-medium">{t.instructor}</td><td className="px-4 py-3">{sessionsDone}</td><td className="px-4 py-3">{rate}</td><td className="px-4 py-3 font-semibold">{(sessionsDone * rate).toLocaleString()}</td></tr></tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Tests() {
  const [phase, setPhase] = useState<"pre" | "post">("pre");
  const [q, setQ] = useState(1);
  const total = 8;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={phase} onValueChange={(v) => setPhase(v as any)}><TabsList><TabsTrigger value="pre">Pre-test</TabsTrigger><TabsTrigger value="post">Post-test</TabsTrigger></TabsList></Tabs>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">Draft</span>
          <span className="text-muted-foreground">Question {q} of {total}</span>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5"><Label>Question</Label><Textarea rows={2} placeholder="Write the question…" /></div>
          <div className="space-y-3">
            {["A","B","C","D"].map((l) => (
              <div key={l} className="flex items-center gap-3 rounded-md border p-3"><input type="radio" name="correct" className="h-4 w-4 accent-[color:var(--primary)]" /><span className="font-semibold">{l}.</span><Input placeholder={`Option ${l}`} className="border-0 shadow-none focus-visible:ring-0" /></div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setQ(Math.max(1, q - 1))}>Previous</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setQ(Math.min(total, q + 1))}><Plus className="mr-1 h-4 w-4" />Add question</Button>
              <Button>Publish &amp; send</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Resources() {
  const files = [
    { name: "negotiation-workbook-v2.pdf", scope: "Whole training", version: "v2" },
    { name: "session-1-slides.pdf", scope: "Session 2024-06-30", version: "v1" },
    { name: "case-study-pack.zip", scope: "Whole training", version: "v1" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid h-32 place-items-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
            <div className="text-center"><Upload className="mx-auto mb-2 h-6 w-6" />Drag &amp; drop files here or click to upload</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 text-left font-medium">File</th><th className="px-4 py-3 text-left font-medium">Attached to</th><th className="px-4 py-3 text-left font-medium">Version</th></tr></thead>
            <tbody>{files.map((f) => (<tr key={f.name} className="border-t"><td className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{f.name}</span></td><td className="px-4 py-3 text-muted-foreground">{f.scope}</td><td className="px-4 py-3 text-muted-foreground">{f.version}</td></tr>))}</tbody>
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