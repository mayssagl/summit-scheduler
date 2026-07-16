import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/s/test/$token")({ component: TestPage });

interface TestQuestion {
  id: string;
  question: string;
  options: { label: string; text: string }[];
}

interface TestAttemptData {
  training_name: string;
  phase: "pre" | "post";
  submitted: boolean;
  questions: TestQuestion[];
}

type Status = "loading" | "invalid" | "ready" | "done";

function TestPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<TestAttemptData | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_test_attempt", { p_token: token }).then(({ data: result, error }) => {
      if (!active) return;
      if (error || !result) {
        setStatus("invalid");
        return;
      }
      const parsed = result as TestAttemptData;
      setData(parsed);
      setStatus(parsed.submitted ? "done" : "ready");
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_test_attempt", { p_token: token, p_answers: answers });
    setSubmitting(false);
    if (error) {
      setStatus("invalid");
      return;
    }
    setStatus("done");
  }

  if (status === "loading") {
    return (
      <StudentShell>
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      </StudentShell>
    );
  }

  if (status === "invalid") {
    return (
      <StudentShell>
        <div className="py-6 text-center">
          <h1 className="text-xl font-semibold">This link has expired</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask your instructor to resend it.</p>
        </div>
      </StudentShell>
    );
  }

  if (status === "done") {
    return (
      <StudentShell>
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"><Check className="h-6 w-6" /></div>
          <h1 className="text-xl font-semibold">Submitted</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your answers were recorded. Your score isn't shown here — your instructor will review the results.</p>
        </div>
      </StudentShell>
    );
  }

  const questions = data!.questions;
  if (questions.length === 0) {
    return (
      <StudentShell>
        <div className="py-6 text-center text-sm text-muted-foreground">This test doesn't have any questions yet.</div>
      </StudentShell>
    );
  }

  const q = questions[i];
  const answered = answers[q.id] != null;

  return (
    <StudentShell>
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{data!.phase === "pre" ? "Pre-test" : "Post-test"} · {data!.training_name}</span>
        <span>Question {i + 1} of {questions.length}</span>
      </div>
      <h1 className="mt-2 text-xl font-semibold">{q.question}</h1>
      <div className="mt-5 space-y-2">
        {q.options.map((o) => (
          <label key={o.label} className={cn("flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition", answers[q.id] === o.label ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
            <input
              type="radio"
              name={`q${q.id}`}
              checked={answers[q.id] === o.label}
              onChange={() => setAnswers({ ...answers, [q.id]: o.label })}
              className="h-4 w-4 accent-[color:var(--primary)]"
            />
            <span className="font-semibold">{o.label}.</span><span>{o.text}</span>
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        {i < questions.length - 1 ? (
          <Button onClick={() => setI(i + 1)} disabled={!answered}>Next</Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!answered || submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
                <AlertDialogDescription>You can't change them after this.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">No login required · your score isn't shared with you.</p>
    </StudentShell>
  );
}
