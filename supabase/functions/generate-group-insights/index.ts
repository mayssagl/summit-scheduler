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

interface StudentRow {
  id: string;
  completion_pct: number;
  status: string;
}

interface TestRow {
  id: string;
  phase: "pre" | "post";
  module: string | null;
  correct_option: string | null;
}

interface TestAttemptRow {
  phase: "pre" | "post";
  answers: Record<string, string>;
  submitted_at: string | null;
}

interface SurveyQuestionRow {
  id: string;
  type: string;
}

interface SurveyResponseRow {
  answers: Record<string, string>;
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
  const groqKey = Deno.env.get("GROQ_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured: missing Supabase environment variables." }, 500);
  }
  if (!groqKey) {
    return json({ error: "Server misconfigured: missing GROQ_API_KEY secret." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  let trainingId: string | undefined;
  try {
    const body = await req.json();
    trainingId = body?.training_id;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!trainingId) return json({ error: "training_id is required." }, 400);

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

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: training, error: trainingError } = await admin
    .from("trainings")
    .select("id, name, client, created_by, attendance_rate, nps, learning_gain, survey_rate, completion_threshold, modules, num_students")
    .eq("id", trainingId)
    .single();
  if (trainingError || !training) return json({ error: "Training not found." }, 404);

  const isAdmin = callerProfile?.role === "admin";
  const isOwningDm = callerProfile?.role === "delivery_manager" && training.created_by === callerAuth.user.id;
  if (!isAdmin && !isOwningDm) {
    return json({ error: "Only admins or the delivery manager who owns this training can generate insights." }, 403);
  }

  // ── cohort data (only queried now that the caller is authorized) ──────────
  const [
    { data: students },
    { data: attendanceRows },
    { data: tests },
    { data: attempts },
    { data: surveyQuestions },
    { data: surveyResponses },
  ] = await Promise.all([
    admin.from("students").select("id, completion_pct, status").eq("training_id", trainingId) as Promise<{ data: StudentRow[] | null }>,
    admin.from("attendance").select("present").eq("training_id", trainingId) as Promise<{ data: { present: boolean }[] | null }>,
    admin.from("tests").select("id, phase, module, correct_option").eq("training_id", trainingId) as Promise<{ data: TestRow[] | null }>,
    admin
      .from("test_attempts")
      .select("phase, answers, submitted_at")
      .eq("training_id", trainingId)
      .not("submitted_at", "is", null) as Promise<{ data: TestAttemptRow[] | null }>,
    admin.from("survey_questions").select("id, type").eq("level", "l1") as Promise<{ data: SurveyQuestionRow[] | null }>,
    admin
      .from("survey_responses")
      .select("answers, submitted_at")
      .eq("training_id", trainingId)
      .eq("level", "l1")
      .not("submitted_at", "is", null) as Promise<{ data: SurveyResponseRow[] | null }>,
  ]);

  const activeStudents = (students ?? []).filter((s) => s.status !== "Dropped");
  const threshold = training.completion_threshold ?? 70;
  const completers = activeStudents.filter((s) => s.completion_pct >= threshold);
  const nonCompletersCount = activeStudents.length - completers.length;

  const attendancePct =
    attendanceRows && attendanceRows.length > 0
      ? Math.round((attendanceRows.filter((a) => a.present).length / attendanceRows.length) * 100)
      : training.attendance_rate;

  // L2 pre/post per module (falls back to a single "Overall" bucket if questions aren't module-tagged)
  const moduleBuckets = new Map<string, { preCorrect: number; preTotal: number; postCorrect: number; postTotal: number }>();
  for (const attempt of attempts ?? []) {
    const phaseTests = (tests ?? []).filter((q) => q.phase === attempt.phase);
    for (const q of phaseTests) {
      const key = q.module?.trim() || "Overall";
      if (!moduleBuckets.has(key)) moduleBuckets.set(key, { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0 });
      const bucket = moduleBuckets.get(key)!;
      const isCorrect = attempt.answers?.[q.id] !== undefined && attempt.answers[q.id] === q.correct_option;
      if (attempt.phase === "pre") {
        bucket.preTotal += 1;
        if (isCorrect) bucket.preCorrect += 1;
      } else {
        bucket.postTotal += 1;
        if (isCorrect) bucket.postCorrect += 1;
      }
    }
  }
  const l2ModuleScores = Array.from(moduleBuckets.entries()).map(([module, b]) => {
    const pre = b.preTotal > 0 ? Math.round((b.preCorrect / b.preTotal) * 100) : null;
    const post = b.postTotal > 0 ? Math.round((b.postCorrect / b.postTotal) * 100) : null;
    return { module, pre_score: pre, post_score: post, gain: pre !== null && post !== null ? post - pre : null };
  });

  // L1 satisfaction average across "1-5" scale questions (answers are stored as numeric strings)
  const scaleQuestionIds = new Set((surveyQuestions ?? []).filter((q) => q.type === "1-5").map((q) => q.id));
  const scaleValues: number[] = [];
  for (const response of surveyResponses ?? []) {
    for (const [questionId, value] of Object.entries(response.answers ?? {})) {
      if (!scaleQuestionIds.has(questionId)) continue;
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) scaleValues.push(parsed);
    }
  }
  const l1AverageSatisfaction =
    scaleValues.length > 0 ? Math.round((scaleValues.reduce((a, b) => a + b, 0) / scaleValues.length) * 10) / 10 : null;

  const cohortData = {
    training_name: training.name,
    client: training.client,
    num_students: training.num_students,
    attendance_pct: attendancePct,
    nps: training.nps,
    l1_average_satisfaction: l1AverageSatisfaction,
    l1_response_count: surveyResponses?.length ?? 0,
    l2_module_scores: l2ModuleScores,
    completers: completers.length,
    non_completers: nonCompletersCount,
    modules: training.modules,
  };

  const prompt = `You are an L&D analyst. Based on this cohort data for the training "${cohortData.training_name}" (client: ${cohortData.client}), produce a concise group report for the account team.

Cohort data (JSON):
${JSON.stringify(cohortData, null, 2)}

Respond with STRICT JSON only, matching exactly this shape and nothing else:
{
  "strengths": string[],
  "shared_gap": string,
  "recommended_next_training": string,
  "talking_points": string[]
}`;

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!groqResponse.ok) {
    const text = await groqResponse.text().catch(() => "");
    return json({ error: `Groq request failed (${groqResponse.status}): ${text.slice(0, 300)}` }, 502);
  }

  let insights: unknown;
  try {
    const data = await groqResponse.json();
    insights = JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return json({ error: `Failed to parse model response: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  const { error: upsertError } = await admin
    .from("group_insights")
    .upsert(
      {
        training_id: trainingId,
        content: insights,
        generated_at: new Date().toISOString(),
        generated_by: callerAuth.user.id,
        status: "draft",
      },
      { onConflict: "training_id" },
    );
  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({ insights });
});
