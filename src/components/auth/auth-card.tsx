import type { ReactNode } from "react";

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-[#e8590c] text-sm font-bold text-white">
        T
      </div>
      <span className="text-lg font-semibold text-gray-900">TrainOps</span>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8fa] p-4 sm:p-6">
      <div className="w-full max-w-[420px] animate-[auth-card-in_0.5s_ease-out] rounded-xl border border-gray-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-6px_rgba(16,24,40,0.08)] sm:p-8">
        <Wordmark />
        {children}
      </div>
    </div>
  );
}
