import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/s/survey-l3/$token")({ component: L3 });

function L3() {
  const [done, setDone] = useState(false);
  const [freq, setFreq] = useState("");
  const [impact, setImpact] = useState(0);

  if (done) return <StudentShell><div className="text-center py-6"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"><Check className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Thank you!</h1><p className="mt-1 text-sm text-muted-foreground">Your follow-up has been recorded.</p></div></StudentShell>;

  return (
    <StudentShell>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Behaviour follow-up</p>
      <h1 className="mt-1 text-2xl font-semibold">One month on…</h1>
      <p className="text-sm text-muted-foreground">A few quick questions about applying what you learned.</p>
      <form className="mt-6 space-y-8" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
        <div>
          <p className="mb-2 text-sm font-medium">How often do you apply what you learned?</p>
          <div className="flex flex-wrap gap-2">{["Never","Rarely","Sometimes","Often","Always"].map((o) => (
            <button key={o} type="button" onClick={() => setFreq(o)} className={cn("rounded-full px-4 py-1.5 text-sm ring-1 ring-inset", freq === o ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted")}>{o}</button>
          ))}</div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Impact on your daily work? (1–5)</p>
          <div className="flex gap-2">{[1,2,3,4,5].map((n) => (
            <button key={n} type="button" onClick={() => setImpact(n)} className={cn("h-10 w-10 rounded-md text-sm ring-1 ring-inset", impact === n ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted")}>{n}</button>
          ))}</div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">What blockers remain?</p>
          <Textarea rows={4} placeholder="Share anything that's getting in the way…" />
        </div>
        <Button type="submit" className="w-full">Submit</Button>
      </form>
    </StudentShell>
  );
}