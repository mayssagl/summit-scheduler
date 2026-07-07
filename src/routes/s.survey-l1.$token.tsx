import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StudentShell, SurveyQuestionField, type SurveyQuestion } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Check } from "lucide-react";

export const Route = createFileRoute("/s/survey-l1/$token")({ component: L1 });

interface SurveyData {
  training_name: string;
  submitted: boolean;
  questions: SurveyQuestion[];
}

type Status = "loading" | "invalid" | "ready" | "done";

function L1() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_survey_response", { p_token: token }).then(({ data: result, error }) => {
      if (!active) return;
      if (error || !result) {
        setStatus("invalid");
        return;
      }
      const parsed = result as SurveyData;
      setData(parsed);
      setStatus(parsed.submitted ? "done" : "ready");
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_survey_response", { p_token: token, p_answers: answers });
    setSubmitting(false);
    if (error) {
      setStatus("invalid");
      return;
    }
    setStatus("done");
  }

  if (status === "loading") {
    return <StudentShell><div className="py-6 text-center text-sm text-muted-foreground">Loading…</div></StudentShell>;
  }

  if (status === "invalid") {
    return (
      <StudentShell>
        <div className="py-6 text-center">
          <h1 className="text-xl font-semibold">This link has expired</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask your admin to resend it.</p>
        </div>
      </StudentShell>
    );
  }

  if (status === "done") {
    return (
      <StudentShell>
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)]"><Check className="h-6 w-6" /></div>
          <h1 className="text-xl font-semibold">Thank you!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your feedback has been submitted.</p>
        </div>
      </StudentShell>
    );
  }

  const questions = data!.questions;
  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <StudentShell>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Satisfaction survey</p>
      <h1 className="mt-1 text-2xl font-semibold">{data!.training_name}</h1>
      <form
        className="mt-6 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions configured yet.</p>
        ) : (
          questions.map((q) => (
            <SurveyQuestionField
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
            />
          ))
        )}
        <Button type="submit" className="w-full" disabled={!allAnswered || submitting}>{submitting ? "Submitting…" : "Submit feedback"}</Button>
      </form>
    </StudentShell>
  );
}
