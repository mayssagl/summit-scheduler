import type { ReactNode } from "react";

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