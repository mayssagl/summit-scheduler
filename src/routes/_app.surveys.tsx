import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SURVEY_QUESTIONS } from "@/lib/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/surveys")({ component: Surveys });

function Surveys() {
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const [tab, setTab] = useState("l1");
  const [l1, setL1] = useState(SURVEY_QUESTIONS.l1);
  const [l3, setL3] = useState(SURVEY_QUESTIONS.l3);
  const types = ["1-5", "0-10 NPS", "Frequency", "Open"];

  const Editor = ({ list, setList }: { list: any[]; setList: (l: any[]) => void }) => (
    <div className="space-y-2">
      {list.map((q, i) => (
        <div key={q.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-12">
          <Input className="sm:col-span-5" placeholder="English" value={q.en} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
          <Input className="sm:col-span-5" placeholder="Français" value={q.fr} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, fr: e.target.value } : x))} />
          <Select value={q.type} onValueChange={(v) => setList(list.map((x, j) => j === i ? { ...x, type: v } : x))}>
            <SelectTrigger className="sm:col-span-2"><SelectValue /></SelectTrigger>
            <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex justify-end sm:col-span-12"><Button variant="ghost" size="icon" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setList([...list, { id: `q${Date.now()}`, en: "", fr: "", type: "1-5" }])}><Plus className="mr-1 h-4 w-4" />Add question</Button>
        <Button size="sm">Save (EN+FR)</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
          <p className="text-sm text-muted-foreground">Define the questions sent to all trainings.</p>
        </div>
        <div className="inline-flex rounded-md border bg-muted/30 p-1">
          {(["EN", "FR"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cn("rounded px-3 py-1 text-sm", lang === l ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Question library</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList><TabsTrigger value="l1">L1 Satisfaction &amp; NPS</TabsTrigger><TabsTrigger value="l3">L3 Behaviour</TabsTrigger></TabsList>
            <TabsContent value="l1" className="pt-4"><Editor list={l1} setList={setL1} /></TabsContent>
            <TabsContent value="l3" className="pt-4"><Editor list={l3} setList={setL3} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}