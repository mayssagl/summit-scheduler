import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { downloadCertificate } from "@/lib/export-html";
import { Award, Download } from "lucide-react";

export const Route = createFileRoute("/s/certificate/$token")({ component: Cert });

interface CertificateData {
  student_name: string;
  training_name: string;
  client: string;
  sentence: string;
  signatory_name: string | null;
  logo_url: string | null;
  signature_url: string | null;
  verification_id: string;
}

type Status = "loading" | "invalid" | "ready";

function Cert() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<CertificateData | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_certificate", { p_token: token }).then(({ data: result, error }) => {
      if (!active) return;
      if (error || !result) {
        setStatus("invalid");
        return;
      }
      setData(result as CertificateData);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (status === "loading") {
    return <StudentShell><div className="py-6 text-center text-sm text-muted-foreground">Loading…</div></StudentShell>;
  }

  if (status === "invalid" || !data) {
    return (
      <StudentShell>
        <div className="py-6 text-center">
          <h1 className="text-xl font-semibold">This link has expired</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask your training provider to resend it.</p>
        </div>
      </StudentShell>
    );
  }

  const firstName = data.student_name.trim().split(/\s+/)[0] || data.student_name;
  const sentence = data.sentence.replace("{student_name}", data.student_name).replace("{training_name}", data.training_name);

  return (
    <StudentShell>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Congratulations, {firstName} 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">You completed {data.training_name} with {data.client}.</p>
      </div>
      <div className="mt-6 rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
        {data.logo_url ? (
          <img src={data.logo_url} alt="Logo" className="mx-auto mb-2 max-h-10" />
        ) : (
          <Award className="mx-auto mb-2 h-10 w-10 text-primary" />
        )}
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate of completion</p>
        <p className="mt-2 text-xl font-semibold">{data.student_name}</p>
        <p className="mt-2 text-xs text-muted-foreground">{sentence}</p>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Verification ID</span>
        <span className="font-mono">{data.verification_id}</span>
      </div>
      <Button
        className="mt-5 w-full"
        onClick={() =>
          downloadCertificate({
            studentName: data.student_name,
            trainingName: data.training_name,
            sentence: data.sentence,
            signatoryName: data.signatory_name,
            logoUrl: data.logo_url,
            signatureUrl: data.signature_url,
            verificationId: data.verification_id,
          })
        }
      >
        <Download className="mr-2 h-4 w-4" />Download PDF
      </Button>
    </StudentShell>
  );
}
