export type Status = "Pending" | "Scheduled" | "Active" | "Completed" | "Cancelled";

export type SessionStatus = "Done" | "Today" | "Ahead";

// Nothing in the app ever updates sessions.status away from its DB default
// ('Ahead'), so it can't be trusted for "has this session happened yet" —
// derive it from the session's own date instead, every time it's read.
export function deriveSessionStatus(dateStr: string): SessionStatus {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (dateStr < todayStr) return "Done";
  if (dateStr === todayStr) return "Today";
  return "Ahead";
}

export const STATUS_COLORS: Record<Status, string> = {
  Pending:
    "bg-[color-mix(in_oklab,var(--status-pending)_30%,white)] text-[color:var(--status-pending-fg)] ring-[color-mix(in_oklab,var(--status-pending)_50%,transparent)]",
  Scheduled:
    "bg-[color-mix(in_oklab,var(--status-scheduled)_22%,white)] text-[color:var(--status-scheduled-fg)] ring-[color-mix(in_oklab,var(--status-scheduled)_50%,transparent)]",
  Active:
    "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-[color-mix(in_oklab,var(--status-active)_50%,transparent)]",
  Completed:
    "bg-[color-mix(in_oklab,var(--status-completed)_45%,white)] text-[color:var(--status-completed-fg)] ring-[color-mix(in_oklab,var(--status-completed)_60%,transparent)]",
  Cancelled:
    "bg-[color-mix(in_oklab,var(--status-cancelled)_22%,white)] text-[color:var(--status-cancelled-fg)] ring-[color-mix(in_oklab,var(--status-cancelled)_50%,transparent)]",
};
