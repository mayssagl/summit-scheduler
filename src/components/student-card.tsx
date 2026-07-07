import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SurveyQuestion {
  id: string;
  en: string;
  fr: string;
  type: string;
}

const FREQUENCY_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Always"];

export function SurveyQuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{question.en}</p>
      {question.type === "1-5" && (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={cn(
                "h-10 w-10 rounded-md text-sm ring-1 ring-inset",
                value === String(n) ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {question.type === "0-10 NPS" && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={cn(
                "h-9 w-9 rounded-md text-sm ring-1 ring-inset",
                value === String(n) ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {question.type === "Frequency" && (
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_OPTIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm ring-1 ring-inset",
                value === o ? "bg-primary text-primary-foreground ring-transparent" : "bg-card ring-border hover:bg-muted",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {question.type === "Open" && (
        <Textarea rows={4} placeholder="Share your thoughts…" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary font-bold text-primary-foreground">T</div>
          TrainOps
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
        <p className="mt-4 text-center text-xs text-muted-foreground">No login needed · this link is single-use and expires soon.</p>
      </div>
    </div>
  );
}