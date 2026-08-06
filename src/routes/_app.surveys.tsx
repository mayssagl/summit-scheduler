import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleRoute } from "@/components/role-route";
import { useSaveSurveyQuestions, useSurveyQuestions } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/surveys")({
  component: () => (
    <RoleRoute allowed={["admin"]}>
      <Surveys />
    </RoleRoute>
  ),
});

interface DraftQuestion {
  key: string;
  en: string;
  fr: string;
  type: string;
}

const DEFAULT_SEED: Record<"l1" | "l3", Omit<DraftQuestion, "key">[]> = {
  l1: [
    { en: "Overall, how satisfied were you with this training?", fr: "Globalement, êtes-vous satisfait de cette formation ?", type: "1-5" },
    { en: "How likely are you to recommend this training?", fr: "Recommanderiez-vous cette formation ?", type: "0-10 NPS" },
    { en: "Any comments to share?", fr: "Avez-vous des commentaires ?", type: "Open" },
  ],
  l3: [
    { en: "How often do you apply what you learned?", fr: "À quelle fréquence appliquez-vous ce que vous avez appris ?", type: "Frequency" },
    { en: "Impact on your daily work?", fr: "Impact sur votre travail quotidien ?", type: "1-5" },
    { en: "What blockers remain?", fr: "Quels obstacles subsistent ?", type: "Open" },
  ],
};

const TYPES = ["1-5", "0-10 NPS", "Frequency", "Open"];

function useDraft(level: "l1" | "l3") {
  const { data, isLoading } = useSurveyQuestions(level);
  const [draft, setDraft] = useState<DraftQuestion[] | null>(null);
  // True until this tab's questions are actually saved to the database —
  // students hitting a link before that will see an empty question list.
  const unsaved = !isLoading && (data?.length ?? 0) === 0;

  useEffect(() => {
    if (draft !== null || isLoading) return;
    const source = data && data.length > 0 ? data : DEFAULT_SEED[level];
    setDraft(source.map((q) => ({ key: `q${Math.random()}`, en: q.en, fr: q.fr, type: q.type })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading]);

  return [draft ?? [], setDraft, unsaved] as const;
}

function Surveys() {
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const [tab, setTab] = useState("l1");
  const [l1, setL1, l1Unsaved] = useDraft("l1");
  const [l3, setL3, l3Unsaved] = useDraft("l3");
  const saveL1 = useSaveSurveyQuestions("l1");
  const saveL3 = useSaveSurveyQuestions("l3");

  async function handleSave(level: "l1" | "l3", list: DraftQuestion[]) {
    const mutation = level === "l1" ? saveL1 : saveL3;
    try {
      await mutation.mutateAsync(list.map(({ en, fr, type }) => ({ en, fr, type })));
      toast.success("Questions saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  const Editor = ({
    list,
    setList,
    level,
    saving,
  }: {
    list: DraftQuestion[];
    setList: (l: DraftQuestion[]) => void;
    level: "l1" | "l3";
    saving: boolean;
  }) => (
    <div className="space-y-2">
      {list.map((q, i) => (
        <div key={q.key} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-12">
          {lang === "EN" ? (
            <Input className="sm:col-span-10" placeholder="English" value={q.en} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
          ) : (
            <Input className="sm:col-span-10" placeholder="French" value={q.fr} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, fr: e.target.value } : x))} />
          )}
          <Select value={q.type} onValueChange={(v) => setList(list.map((x, j) => j === i ? { ...x, type: v } : x))}>
            <SelectTrigger className="sm:col-span-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex justify-end sm:col-span-1"><Button variant="ghost" size="icon" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setList([...list, { key: `q${Math.random()}`, en: "", fr: "", type: "1-5" }])}><Plus className="mr-1 h-4 w-4" />Add question</Button>
        <Button size="sm" onClick={() => handleSave(level, list)} disabled={saving}>{saving ? "Saving…" : "Save (EN+FR)"}</Button>
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
            <TabsContent value="l1" className="space-y-3 pt-4">
              {l1Unsaved && (
                <p className="rounded-md border border-[color:var(--status-pending)]/40 bg-[color:var(--status-pending)]/10 px-3 py-2 text-xs text-[color:var(--status-pending-fg)]">
                  These are default questions and haven't been saved yet — students opening a link before you click Save will see no questions.
                </p>
              )}
              <Editor list={l1} setList={setL1} level="l1" saving={saveL1.isPending} />
            </TabsContent>
            <TabsContent value="l3" className="space-y-3 pt-4">
              {l3Unsaved && (
                <p className="rounded-md border border-[color:var(--status-pending)]/40 bg-[color:var(--status-pending)]/10 px-3 py-2 text-xs text-[color:var(--status-pending-fg)]">
                  These are default questions and haven't been saved yet — students opening a link before you click Save will see no questions.
                </p>
              )}
              <Editor list={l3} setList={setL3} level="l3" saving={saveL3.isPending} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
