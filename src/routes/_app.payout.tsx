import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useAllSessions, useTrainings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/payout")({ component: Payout });

function Payout() {
  const { role } = useAuth();
  const rate = 450;
  const { data: trainings = [] } = useTrainings();
  const { data: sessions = [] } = useAllSessions();

  const doneCountByTraining = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== "Done") continue;
      map.set(s.training_id, (map.get(s.training_id) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  const rows = useMemo(
    () =>
      trainings.map((t) => {
        const done = doneCountByTraining.get(t.id) ?? 0;
        return {
          id: t.id,
          name: t.name,
          instructor: t.instructor_name ?? "—",
          sessions: done,
          docValue: t.po_value ?? 0,
          payout: done * rate,
        };
      }),
    [trainings, doneCountByTraining],
  );

  const total = rows.reduce((a, r) => a + r.payout, 0);
  const sessionsThisMonth = rows.reduce((a, r) => a + r.sessions, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payout</h1>
        <p className="text-sm text-muted-foreground">{role === "instructor" ? "Your delivery earnings." : "Read-only payout summary across trainings."}</p>
      </div>

      {role === "instructor" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">This month total</p><p className="mt-1 text-2xl font-semibold">{total.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Sessions delivered</p><p className="mt-1 text-2xl font-semibold">{sessionsThisMonth}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Trainings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Training</th>
                  {role !== "instructor" && <th className="px-4 py-3 text-left font-medium">Instructor</th>}
                  <th className="px-4 py-3 text-left font-medium">Sessions delivered</th>
                  {role !== "instructor" && <th className="px-4 py-3 text-left font-medium">Doc value</th>}
                  {role === "instructor" && <th className="px-4 py-3 text-left font-medium">Rate</th>}
                  <th className="px-4 py-3 text-left font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    {role !== "instructor" && <td className="px-4 py-3 text-muted-foreground">{r.instructor}</td>}
                    <td className="px-4 py-3">{r.sessions}</td>
                    {role !== "instructor" && <td className="px-4 py-3">{r.docValue.toLocaleString()}</td>}
                    {role === "instructor" && <td className="px-4 py-3">{rate}</td>}
                    <td className="px-4 py-3 font-semibold">{r.payout.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
