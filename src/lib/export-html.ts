function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_STYLES = `
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; color: #1c1917; margin: 0; padding: 2rem; }
  .page { max-width: 720px; margin: 0 auto 3rem; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  .muted { color: #78716c; font-size: 0.875rem; }
`;

export function downloadHtml(filename: string, bodyHtml: string) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title><style>${BASE_STYLES}</style></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob([doc], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface CertificateExportData {
  studentName: string;
  trainingName: string;
  sentence: string;
  signatoryName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  verificationId: string;
}

export function certificateHtml(cert: CertificateExportData) {
  const sentence = cert.sentence
    .replace("{student_name}", escapeHtml(cert.studentName))
    .replace("{training_name}", escapeHtml(cert.trainingName));
  return `
    <div class="page" style="text-align:center; border: 2px dashed #d6d3d1; border-radius: 12px; padding: 3rem;">
      ${cert.logoUrl ? `<img src="${escapeHtml(cert.logoUrl)}" alt="Logo" style="max-height:48px; margin-bottom:1rem;" />` : ""}
      <p class="muted" style="text-transform:uppercase; letter-spacing:0.1em;">Certificate of completion</p>
      <h1 style="font-size:2rem; margin-top:0.75rem;">${escapeHtml(cert.studentName)}</h1>
      <p style="max-width:32rem; margin: 1rem auto; color:#44403c;">${sentence}</p>
      <div style="display:flex; justify-content:space-between; margin-top:3rem; font-size:0.75rem; color:#78716c;">
        <div style="text-align:left;">
          ${cert.signatureUrl ? `<img src="${escapeHtml(cert.signatureUrl)}" alt="Signature" style="max-height:32px; display:block; margin-bottom:0.25rem;" />` : `<div style="height:1px; width:8rem; background:#a8a29e; margin-bottom:0.25rem;"></div>`}
          ${escapeHtml(cert.signatoryName ?? "Signatory")}
        </div>
        <div>ID: ${escapeHtml(cert.verificationId)}</div>
      </div>
    </div>
  `;
}

export function downloadCertificate(cert: CertificateExportData) {
  downloadHtml(`certificate-${cert.studentName.replace(/\s+/g, "-").toLowerCase()}`, certificateHtml(cert));
}

export function downloadCertificatesBundle(certs: CertificateExportData[], trainingName: string) {
  downloadHtml(`certificates-${trainingName.replace(/\s+/g, "-").toLowerCase()}`, certs.map(certificateHtml).join(""));
}

export interface GroupReportExportData {
  trainingName: string;
  attendanceRate: number;
  learningGain: number;
  nps: number;
  insights: { title: string; body: string }[];
}

export function downloadGroupReport(report: GroupReportExportData) {
  const stats = `
    <div style="display:flex; gap:1rem; margin: 1.5rem 0;">
      <div style="flex:1; border:1px solid #e7e5e4; border-radius:8px; padding:1rem;"><div class="muted">Attendance</div><div style="font-size:1.5rem; font-weight:600;">${report.attendanceRate}%</div></div>
      <div style="flex:1; border:1px solid #e7e5e4; border-radius:8px; padding:1rem;"><div class="muted">Learning gain</div><div style="font-size:1.5rem; font-weight:600;">+${report.learningGain}%</div></div>
      <div style="flex:1; border:1px solid #e7e5e4; border-radius:8px; padding:1rem;"><div class="muted">NPS</div><div style="font-size:1.5rem; font-weight:600;">${report.nps}</div></div>
    </div>
  `;
  const insights = report.insights
    .map(
      (i) =>
        `<div style="border:1px solid #e7e5e4; border-radius:8px; padding:1rem; margin-bottom:0.75rem;"><h2 style="font-size:0.95rem; margin:0 0 0.4rem;">${escapeHtml(i.title)}</h2><p style="margin:0; color:#44403c; font-size:0.9rem;">${escapeHtml(i.body)}</p></div>`,
    )
    .join("");
  const body = `<div class="page"><h1>${escapeHtml(report.trainingName)} — Group report</h1><p class="muted">Generated ${new Date().toLocaleDateString()}</p>${stats}${insights}</div>`;
  downloadHtml(`group-report-${report.trainingName.replace(/\s+/g, "-").toLowerCase()}`, body);
}
