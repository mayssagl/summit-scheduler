// Inlined as base64 (?inline forces this regardless of file size) so a downloaded
// certificate HTML file stays self-contained and renders correctly even when opened
// outside the app (no dependency on the app's own hosting to resolve the image).
import defaultLogoUrl from "@/assets/logo.png?inline";
import defaultQrUrl from "@/assets/qrcode.png?inline";

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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadHtml(filename: string, bodyHtml: string) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title><style>${BASE_STYLES}</style></head><body>${bodyHtml}</body></html>`;
  downloadBlob(filename.endsWith(".html") ? filename : `${filename}.html`, new Blob([doc], { type: "text/html" }));
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export interface CertificateExportData {
  studentName: string;
  trainingName: string;
  sentence: string;
  signatoryName: string | null;
  logoUrl: string | null;
  logoPosition?: "left" | "right";
  signatureUrl: string | null;
  signatory2Name?: string | null;
  signature2Url?: string | null;
  verificationId: string;
}

function signatureBlock(name: string | null | undefined, url: string | null | undefined, fallback: string, align: "left" | "right") {
  const lineMargin = align === "left" ? "margin-bottom:0.25rem;" : "margin-bottom:0.25rem; margin-left:auto;";
  return `
    <div style="text-align:${align};">
      ${url ? `<img src="${escapeHtml(url)}" alt="Signature" style="max-height:32px; display:block; ${align === "left" ? "" : "margin-left:auto;"} margin-bottom:0.25rem;" />` : `<div style="height:1px; width:8rem; background:#a8a29e; ${lineMargin}"></div>`}
      ${escapeHtml(name || fallback)}
    </div>
  `;
}

export function certificateHtml(cert: CertificateExportData) {
  const sentence = cert.sentence
    .replace("{student_name}", escapeHtml(cert.studentName))
    .replace("{training_name}", escapeHtml(cert.trainingName));
  const logoAlign = cert.logoPosition === "left" ? "flex-start" : "flex-end";
  const hasSecondSignature = !!(cert.signatory2Name || cert.signature2Url);
  return `
    <div class="page" style="text-align:center; border: 2px dashed #d6d3d1; border-radius: 12px; padding: 3rem;">
      <div style="display:flex; justify-content:${logoAlign}; margin-bottom:1rem;">
        <img src="${escapeHtml(cert.logoUrl ?? defaultLogoUrl)}" alt="Logo" style="max-height:48px;" />
      </div>
      <p class="muted" style="text-transform:uppercase; letter-spacing:0.1em;">Certificate of completion</p>
      <h1 style="font-size:2rem; margin-top:0.75rem;">${escapeHtml(cert.studentName)}</h1>
      <p style="max-width:32rem; margin: 1rem auto; color:#44403c;">${sentence}</p>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:3rem; font-size:0.75rem; color:#78716c;">
        ${signatureBlock(cert.signatoryName, cert.signatureUrl, "Signatory", "left")}
        ${hasSecondSignature ? signatureBlock(cert.signatory2Name, cert.signature2Url, "Signatory", "right") : "<div></div>"}
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:0.5rem;">
        <img src="${defaultQrUrl}" alt="QR code" style="height:56px; width:56px;" />
      </div>
      <div style="margin-top:1rem; font-size:0.7rem; color:#a8a29e;">ID: ${escapeHtml(cert.verificationId)}</div>
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
