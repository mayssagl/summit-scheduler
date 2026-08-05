import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type EmailType = "welcome" | "survey" | "test" | "certificate";

interface RequestBody {
  type: EmailType;
  training_id: string;
  student_id: string;
  origin: string;
  level?: "l1" | "l3";
  phase?: "pre" | "post";
  token?: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Plain-text fallback Bird requires alongside the HTML body.
function htmlToText(html: string) {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: #6b7280; margin: 0 0 16px;">TrainOps</p>
      <h1 style="font-size: 20px; margin: 0 0 12px;">${title}</h1>
      <div style="font-size: 14px; line-height: 1.6; color: #374151;">${bodyHtml}</div>
      ${
        ctaLabel && ctaUrl
          ? `<p style="margin: 24px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">${ctaLabel}</a></p>`
          : ""
      }
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">No login needed.</p>
    </div>
  `;
}

function buildEmail(
  type: EmailType,
  studentName: string,
  trainingName: string,
  origin: string,
  level?: "l1" | "l3",
  phase?: "pre" | "post",
  token?: string,
) {
  const first = studentName.trim().split(/\s+/)[0] || "there";

  if (type === "welcome") {
    return {
      subject: `You're enrolled in ${trainingName}`,
      html: wrap(`Welcome, ${escapeHtml(first)}`, `<p>You've been enrolled in <strong>${escapeHtml(trainingName)}</strong>. Your trainer will share session details separately.</p>`),
    };
  }

  if (type === "survey" && token) {
    const isL3 = level === "l3";
    const url = `${origin}/s/${isL3 ? "survey-l3" : "survey-l1"}/${token}`;
    return {
      subject: isL3 ? `One month on — ${trainingName}` : `Quick feedback — ${trainingName}`,
      html: wrap(
        isL3 ? "One month on…" : "Quick feedback",
        `<p>${isL3 ? "How has it gone applying what you learned in" : "A 1-minute survey about"} <strong>${escapeHtml(trainingName)}</strong>?</p>`,
        "Open survey",
        url,
      ),
    };
  }

  if (type === "test" && token) {
    const url = `${origin}/s/test/${token}`;
    const label = phase === "post" ? "Post-test" : "Pre-test";
    return {
      subject: `${label} — ${trainingName}`,
      html: wrap(
        `${label}: ${escapeHtml(trainingName)}`,
        `<p>Please complete your ${label.toLowerCase()}. It takes a few minutes and your score isn't shared with you.</p>`,
        "Start test",
        url,
      ),
    };
  }

  if (type === "certificate" && token) {
    const url = `${origin}/s/certificate/${token}`;
    return {
      subject: `Your certificate — ${trainingName}`,
      html: wrap(`Congratulations, ${escapeHtml(first)}`, `<p>You completed <strong>${escapeHtml(trainingName)}</strong>. Your certificate is ready.</p>`, "Download certificate", url),
    };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const birdApiKey = Deno.env.get("BIRD_API_KEY");
  const birdWorkspaceId = Deno.env.get("BIRD_WORKSPACE_ID");
  const birdChannelId = Deno.env.get("BIRD_CHANNEL_ID");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured: missing Supabase environment variables." }, 500);
  }
  if (!birdApiKey || !birdWorkspaceId || !birdChannelId) {
    return json({ error: "Server misconfigured: missing BIRD_API_KEY, BIRD_WORKSPACE_ID or BIRD_CHANNEL_ID secret." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body.type || !body.training_id || !body.student_id || !body.origin) {
    return json({ error: "type, training_id, student_id and origin are required." }, 400);
  }

  // Verify the caller against their own JWT (respects RLS) before touching anything privileged.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
  if (callerAuthError || !callerAuth.user) return json({ error: "Not authenticated." }, 401);

  const { data: callerProfile } = await callerClient.from("profiles").select("role").eq("id", callerAuth.user.id).single();

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: training } = await admin.from("trainings").select("id, name, created_by").eq("id", body.training_id).single();
  if (!training) return json({ error: "Training not found." }, 404);

  const isAdmin = callerProfile?.role === "admin";
  const isOwningDm = callerProfile?.role === "delivery_manager" && training.created_by === callerAuth.user.id;
  if (!isAdmin && !isOwningDm) {
    return json({ error: "Only admins or the delivery manager who owns this training can email students." }, 403);
  }

  const { data: student } = await admin
    .from("students")
    .select("id, name, email, training_id")
    .eq("id", body.student_id)
    .eq("training_id", body.training_id)
    .single();
  if (!student) return json({ error: "Student not found." }, 404);

  const email = buildEmail(body.type, student.name, training.name, body.origin, body.level, body.phase, body.token);
  if (!email) return json({ error: "Invalid email type or missing token." }, 400);

  // Bird's from-address is fixed by the email channel's own configuration —
  // it can't be set per-message like SendGrid/Resend allowed.
  const birdResponse = await fetch(`https://api.bird.com/workspaces/${birdWorkspaceId}/channels/${birdChannelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `AccessKey ${birdApiKey}` },
    body: JSON.stringify({
      receiver: { contacts: [{ identifierValue: student.email }] },
      body: {
        type: "html",
        html: {
          metadata: { subject: email.subject },
          html: email.html,
          text: htmlToText(email.html),
        },
      },
    }),
  });

  if (!birdResponse.ok) {
    const text = await birdResponse.text().catch(() => "");
    return json({ error: `Bird request failed (${birdResponse.status}): ${text.slice(0, 300)}` }, 502);
  }

  return json({ ok: true });
});
