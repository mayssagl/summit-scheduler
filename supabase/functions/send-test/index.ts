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

interface TestRow {
  id: string;
  options: { label: string; text: string }[];
  correct_option: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
}

interface AttemptRow {
  student_id: string;
  share_token: string;
  submitted_at: string | null;
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
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const siteUrl = Deno.env.get("SITE_URL");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured: missing Supabase environment variables." }, 500);
  }
  if (!resendKey) {
    return json({ error: "Server misconfigured: missing RESEND_API_KEY secret." }, 500);
  }
  if (!siteUrl) {
    return json({ error: "Server misconfigured: missing SITE_URL secret." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  let trainingId: string | undefined;
  let phase: "pre" | "post" | undefined;
  try {
    const body = await req.json();
    trainingId = body?.training_id;
    phase = body?.phase;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!trainingId) return json({ error: "training_id is required." }, 400);
  if (phase !== "pre" && phase !== "post")
    return json({ error: "phase must be 'pre' or 'post'." }, 400);

  // Verify the caller against their own JWT (respects RLS) before touching anything privileged.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
  if (callerAuthError || !callerAuth.user) return json({ error: "Not authenticated." }, 401);

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", callerAuth.user.id)
    .single();

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: training, error: trainingError } = await admin
    .from("trainings")
    .select("id, name, instructor_id, created_by")
    .eq("id", trainingId)
    .single();
  if (trainingError || !training) return json({ error: "Training not found." }, 404);

  const isAdmin = callerProfile?.role === "admin";
  const isOwningDm =
    callerProfile?.role === "delivery_manager" && training.created_by === callerAuth.user.id;
  const isAssignedInstructor =
    callerProfile?.role === "instructor" && training.instructor_id === callerAuth.user.id;
  if (!isAdmin && !isOwningDm && !isAssignedInstructor) {
    return json(
      {
        error:
          "Only admins, the owning delivery manager, or the assigned instructor can publish this test.",
      },
      403,
    );
  }

  // ── validate the question bank ─────────────────────────────────────────
  const { data: questions, error: questionsError } = (await admin
    .from("tests")
    .select("id, options, correct_option")
    .eq("training_id", trainingId)
    .eq("phase", phase)) as { data: TestRow[] | null; error: unknown };
  if (questionsError) return json({ error: "Failed to load questions." }, 500);

  const qs = questions ?? [];
  if (qs.length < 10) {
    return json(
      {
        error: `This test has ${qs.length} question(s) — at least 10 are required before publishing.`,
      },
      422,
    );
  }
  const invalid = qs.filter((q) => {
    if (!q.correct_option) return true;
    if (!Array.isArray(q.options) || q.options.length !== 4) return true;
    return q.options.some((o) => !o.text || !o.text.trim());
  });
  if (invalid.length > 0) {
    return json(
      {
        error: `${invalid.length} question(s) are incomplete — every question needs all 4 options filled and a correct answer marked.`,
      },
      422,
    );
  }

  // ── enrolled students ───────────────────────────────────────────────────
  const { data: students, error: studentsError } = (await admin
    .from("students")
    .select("id, name, email")
    .eq("training_id", trainingId)
    .neq("status", "Dropped")) as { data: StudentRow[] | null; error: unknown };
  if (studentsError) return json({ error: "Failed to load students." }, 500);

  const roster = students ?? [];
  if (roster.length === 0) {
    return json({ error: "No active students to publish to." }, 422);
  }

  const { data: existingAttempts, error: attemptsError } = (await admin
    .from("test_attempts")
    .select("student_id, share_token, submitted_at")
    .eq("training_id", trainingId)
    .eq("phase", phase)) as { data: AttemptRow[] | null; error: unknown };
  if (attemptsError) return json({ error: "Failed to load existing attempts." }, 500);

  const existingByStudent = new Map((existingAttempts ?? []).map((a) => [a.student_id, a]));

  const toCreate = roster.filter((s) => !existingByStudent.has(s.id));
  const toResend = roster.filter((s) => {
    const existing = existingByStudent.get(s.id);
    return existing && !existing.submitted_at;
  });
  const skipped = roster.length - toCreate.length - toResend.length;

  let createdTokens: { student_id: string; share_token: string }[] = [];
  if (toCreate.length > 0) {
    const { data: created, error: createError } = (await admin
      .from("test_attempts")
      .insert(toCreate.map((s) => ({ training_id: trainingId, student_id: s.id, phase })))
      .select("student_id, share_token")) as {
      data: { student_id: string; share_token: string }[] | null;
      error: unknown;
    };
    if (createError) return json({ error: "Failed to create attempts." }, 500);
    createdTokens = created ?? [];
  }

  const tokenByStudent = new Map<string, string>();
  for (const c of createdTokens) tokenByStudent.set(c.student_id, c.share_token);
  for (const s of toResend) {
    const existing = existingByStudent.get(s.id);
    if (existing) tokenByStudent.set(s.id, existing.share_token);
  }

  const toEmail = [...toCreate, ...toResend].filter((s) => tokenByStudent.has(s.id));
  const phaseLabel = phase === "pre" ? "Pre-test" : "Post-test";
  const subject = `${phaseLabel} · ${training.name}`;

  let failed = 0;
  for (const student of toEmail) {
    const shareToken = tokenByStudent.get(student.id)!;
    const link = `${siteUrl}/s/test/${shareToken}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${phaseLabel} · ${training.name}</h2>
        <p>Hi ${student.name},</p>
        <p>Please complete your ${phase === "pre" ? "pre-test" : "post-test"} for ${training.name}.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #111827; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Start ${phaseLabel}</a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">No login required · your score isn't shared with you.</p>
      </div>
    `;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: student.email,
          subject,
          html,
        }),
      });
      if (!res.ok) failed += 1;
    } catch {
      failed += 1;
    }
  }

  const { error: pubError } = await admin.from("test_publications").upsert(
    {
      training_id: trainingId,
      phase,
      status: "published",
      published_at: new Date().toISOString(),
      created_by: callerAuth.user.id,
    },
    { onConflict: "training_id,phase" },
  );
  if (pubError)
    return json({ error: "Sent, but failed to mark the test published: " + pubError.message }, 500);

  return json({ sent: toEmail.length, skipped, failed: failed > 0 ? failed : undefined });
});
