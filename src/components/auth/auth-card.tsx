import type { ReactNode } from "react";

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        T
      </div>
      <span className="text-lg font-semibold text-foreground">TrainOps</span>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4 sm:p-6">
      <div className="w-full max-w-[420px] animate-[auth-card-in_0.5s_ease-out] rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-6px_rgba(16,24,40,0.08)] sm:p-8">
        <Wordmark />
        {children}
      </div>
    </div>
  );
}
