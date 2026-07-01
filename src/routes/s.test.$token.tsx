import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/s/test/$token")({ component: TestPage });

const QUESTIONS = [
  { q: "Which is the best opener for a high-stakes negotiation?", opts: ["Lead with your bottom line", "Anchor with a principled ask", "Wait for the other side", "Open with a discount"] },
  { q: "What is BATNA?", opts: ["Best Alternative To a Negotiated Agreement", "Bilateral Agreement Trade Norm", "Base Anchor Tactic Number", "Buyer Approval Threshold"] },
  { q: "When the other side pushes back, you should…", opts: ["Concede quickly", "Restate your interests", "End the meeting", "Lower the price"] },
];

function TestPage() {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const q = QUESTIONS[i];

  if (done) return <StudentShell><div className="text-center py-6"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"><Check className="h-6 w-6" /></div><h1 className="text-xl font-semibold">Submitted</h1><p className="mt-1 text-sm text-muted-foreground">Your answers were recorded. Your score isn't shown here — your instructor will review the results.</p></div></StudentShell>;

  return (
    <StudentShell>
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground"><span>Knowledge check</span><span>Question {i + 1} of {QUESTIONS.length}</span></div>
      <h1 className="mt-2 text-xl font-semibold">{q.q}</h1>
      <div className="mt-5 space-y-2">
        {q.opts.map((o, j) => (
          <label key={j} className={cn("flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition", answers[i] === j ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
            <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers(answers.map((a, k) => k === i ? j : a))} className="h-4 w-4 accent-[color:var(--primary)]" />
            <span className="font-semibold">{"ABCD"[j]}.</span><span>{o}</span>
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        {i < QUESTIONS.length - 1 ? <Button onClick={() => setI(i + 1)} disabled={answers[i] === null}>Next</Button> : <Button onClick={() => setDone(true)} disabled={answers[i] === null}>Submit</Button>}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Your score isn't shown to you.</p>
    </StudentShell>
  );
}