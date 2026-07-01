import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Star, Check } from "lucide-react";

export const Route = createFileRoute("/s/survey-l1/$token")({ component: L1 });

function L1() {
  const [sent, setSent] = useState(false);
  const [sat, setSat] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [rec, setRec] = useState(0);

  if (sent) return (
    <StudentShell><div className="text-center py-6"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"><Check className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Thank you!</h1><p className="mt-1 text-sm text-muted-foreground">Your feedback has been submitted.</p></div></StudentShell>
  );

  return (
    <StudentShell>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Satisfaction survey</p>
      <h1 className="mt-1 text-2xl font-semibold">Negotiation Skills</h1>
      <p className="text-sm text-muted-foreground">Acme Corp</p>
      <form className="mt-6 space-y-8" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
        <div>
          <p className="mb-2 text-sm font-medium">Overall, how satisfied were you with this training?</p>
          <div className="flex gap-2">{[1,2,3,4,5].map((n) => (
            <button key={n} type="button" onClick={() => setSat(n)} className={cn("inline-grid h-11 w-11 place-items-center rounded-md ring-1 ring-inset transition", n <= sat ? "bg-primary text-primary-foreground ring-transparent" : "bg-card text-muted-foreground ring-border hover:bg-muted")}>
              <Star className={cn("h-5 w-5", n <= sat && "fill-current")} />
            </button>
          ))}</div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">How likely are you to recommend this training? (0–10)</p>
          <div className="flex flex-wrap gap-1.5">{Array.from({length:11}, (_,i) => i).map((n) => (
            <button key={n} type="button" onClick={() => setNps(n)} className={cn("h-9 w-9 rounded-md text-sm ring-1 ring-inset", nps === n ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted")}>{n}</button>
          ))}</div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">How relevant was the content to your role?</p>
          <div className="flex gap-2">{[1,2,3,4,5].map((n) => (
            <button key={n} type="button" onClick={() => setRec(n)} className={cn("h-9 min-w-9 rounded-full px-3 text-sm ring-1 ring-inset", n === rec ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted")}>{n}</button>
          ))}</div>
        </div>
        <Button type="submit" className="w-full">Submit feedback</Button>
      </form>
    </StudentShell>
  );
}