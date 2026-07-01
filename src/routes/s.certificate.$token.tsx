import { createFileRoute } from "@tanstack/react-router";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { Award, Download } from "lucide-react";

export const Route = createFileRoute("/s/certificate/$token")({ component: Cert });

function Cert() {
  return (
    <StudentShell>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Congratulations, Emma 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">You completed Negotiation Skills with Acme Corp.</p>
      </div>
      <div className="mt-6 rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
        <Award className="mx-auto mb-2 h-10 w-10 text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate of completion</p>
        <p className="mt-2 text-xl font-semibold">Emma Chen</p>
        <p className="mt-2 text-xs text-muted-foreground">has successfully completed</p>
        <p className="text-base font-medium">Negotiation Skills</p>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Verification ID</span>
        <span className="font-mono">TO-2024-T1-EMMA-001</span>
      </div>
      <Button className="mt-5 w-full"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
    </StudentShell>
  );
}