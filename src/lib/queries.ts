import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Status } from "@/lib/status";
import type { AppRole } from "@/lib/auth";

export interface TrainingRow {
  id: string;
  name: string;
  client: string;
  country: string | null;
  venue: string | null;
  language: "EN" | "FR";
  num_students: number;
  start_date: string | null;
  end_date: string | null;
  completion_threshold: number;
  po_ref: string | null;
  po_value: number | null;
  status: Status;
  instructor_id: string | null;
  created_by: string;
  modules: string[];
  nps: number;
  survey_rate: number;
  learning_gain: number;
  attendance_rate: number;
  certificate_sentence: string;
  certificate_signatory_name: string | null;
  certificate_logo_url: string | null;
  certificate_signature_url: string | null;
  doc_start_date: string | null;
  doc_end_date: string | null;
  po_file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingWithInstructor extends TrainingRow {
  instructor_name: string | null;
}

type TrainingWithInstructorJoin = TrainingRow & { instructor: { full_name: string } | null };

export interface SessionRow {
  id: string;
  training_id: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  venue: string | null;
  module: string | null;
  status: "Done" | "Today" | "Ahead";
  created_at: string;
}

export interface StudentRow {
  id: string;
  training_id: string;
  name: string;
  email: string;
  dept: string | null;
  status: "Active" | "Invited" | "Dropped";
  attendance_pct: number;
  completion_pct: number;
  cert_issued: boolean;
  created_at: string;
}

export interface CertificateRow {
  id: string;
  training_id: string;
  student_id: string;
  template: string;
  file_url: string | null;
  issued_at: string | null;
  share_token: string;
  created_at: string;
}

export interface TestRow {
  id: string;
  training_id: string;
  phase: "pre" | "post";
  question: string;
  options: { label: string; text: string }[];
  correct_option: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface ResourceRow {
  id: string;
  training_id: string;
  session_id: string | null;
  name: string;
  file_url: string;
  scope: string;
  version: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SurveyQuestionRow {
  id: string;
  level: "l1" | "l3";
  en: string;
  fr: string;
  type: string;
  position: number;
  created_at: string;
}

export interface SurveyResponseRow {
  id: string;
  training_id: string;
  student_id: string;
  level: "l1" | "l3";
  share_token: string;
  answers: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string;
}

export interface TestAttemptRow {
  id: string;
  training_id: string;
  student_id: string;
  phase: "pre" | "post";
  share_token: string;
  answers: Record<string, unknown>;
  score: number | null;
  submitted_at: string | null;
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  training_id: string;
  session_id: string;
  student_id: string;
  present: boolean;
  marked_by: string | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "invited" | "active";
  created_at: string;
}

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ── trainings ────────────────────────────────────────────────────

export function useTrainings() {
  return useQuery({
    queryKey: ["trainings"],
    queryFn: async (): Promise<TrainingWithInstructor[]> => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*, instructor:profiles!trainings_instructor_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      raise(error);
      return ((data ?? []) as unknown as TrainingWithInstructorJoin[]).map(({ instructor, ...row }) => ({
        ...row,
        instructor_name: instructor?.full_name ?? null,
      }));
    },
  });
}

export function useTraining(id: string) {
  return useQuery({
    queryKey: ["training", id],
    queryFn: async (): Promise<TrainingWithInstructor | null> => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*, instructor:profiles!trainings_instructor_id_fkey(full_name)")
        .eq("id", id)
        .maybeSingle();
      raise(error);
      if (!data) return null;
      const { instructor, ...row } = data as unknown as TrainingWithInstructorJoin;
      return { ...row, instructor_name: instructor?.full_name ?? null };
    },
  });
}

export interface NewTrainingInput {
  name: string;
  client: string;
  country: string;
  venue: string;
  language: "EN" | "FR";
  num_students: number;
  completion_threshold: number;
  instructor_id: string | null;
  start_date: string | null;
  end_date: string | null;
  modules: string[];
  po_ref: string;
  po_value: number | null;
  doc_start_date: string | null;
  doc_end_date: string | null;
  po_file_url: string | null;
  created_by: string;
}

export interface NewSessionInput {
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  venue: string;
  module: string;
}

export function useCreateTrainingWithSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      training,
      sessions,
      poFile,
    }: {
      training: NewTrainingInput;
      sessions: NewSessionInput[];
      poFile?: File | null;
    }) => {
      const { data: created, error } = await supabase.from("trainings").insert(training).select("id").single();
      raise(error);
      const trainingId = created!.id as string;

      if (sessions.length > 0) {
        const { error: sessionsError } = await supabase
          .from("sessions")
          .insert(sessions.map((s) => ({ ...s, training_id: trainingId })));
        raise(sessionsError);
      }

      if (poFile) {
        const url = await uploadTrainingFile("documents", trainingId, poFile);
        const { error: updateError } = await supabase.from("trainings").update({ po_file_url: url }).eq("id", trainingId);
        raise(updateError);
      }

      return trainingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainings"] });
    },
  });
}

// ── sessions ─────────────────────────────────────────────────────

export function useAllSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase.from("sessions").select("*").order("date", { ascending: true });
      raise(error);
      return data ?? [];
    },
  });
}

export function useTrainingSessions(trainingId: string) {
  return useQuery({
    queryKey: ["sessions", trainingId],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("training_id", trainingId)
        .order("date", { ascending: true });
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export function useAddSession(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewSessionInput) => {
      const { error } = await supabase.from("sessions").insert({ ...input, training_id: trainingId });
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", trainingId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

// ── students ─────────────────────────────────────────────────────

export function useTrainingStudents(trainingId: string) {
  return useQuery({
    queryKey: ["students", trainingId],
    queryFn: async (): Promise<StudentRow[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("training_id", trainingId)
        .order("name", { ascending: true });
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export interface NewStudentInput {
  name: string;
  email: string;
  dept: string;
}

export function useAddStudents(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (students: NewStudentInput[]) => {
      const { error } = await supabase
        .from("students")
        .insert(students.map((s) => ({ ...s, training_id: trainingId })));
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", trainingId] });
    },
  });
}

// ── attendance ───────────────────────────────────────────────────

export function useTrainingAttendance(trainingId: string) {
  return useQuery({
    queryKey: ["attendance", trainingId],
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase.from("attendance").select("*").eq("training_id", trainingId);
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export function useSetAttendance(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, studentId, present }: { sessionId: string; studentId: string; present: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("attendance")
        .upsert(
          { session_id: sessionId, student_id: studentId, present, marked_by: user?.id ?? null },
          { onConflict: "session_id,student_id" },
        );
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", trainingId] });
    },
  });
}

// ── certificates ─────────────────────────────────────────────────

export function useTrainingCertificates(trainingId: string) {
  return useQuery({
    queryKey: ["certificates", trainingId],
    queryFn: async (): Promise<CertificateRow[]> => {
      const { data, error } = await supabase.from("certificates").select("*").eq("training_id", trainingId);
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export interface CertificateTemplateInput {
  certificate_sentence: string;
  certificate_signatory_name: string;
  certificate_logo_url: string | null;
  certificate_signature_url: string | null;
}

export function useUpdateCertificateTemplate(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CertificateTemplateInput) => {
      const { error } = await supabase.from("trainings").update(input).eq("id", trainingId);
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training", trainingId] });
      queryClient.invalidateQueries({ queryKey: ["trainings"] });
    },
  });
}

export function useIssueCertificates(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (studentIds: string[]) => {
      if (studentIds.length === 0) return;
      const { error } = await supabase
        .from("certificates")
        .upsert(
          studentIds.map((studentId) => ({ training_id: trainingId, student_id: studentId, issued_at: new Date().toISOString() })),
          { onConflict: "training_id,student_id", ignoreDuplicates: true },
        );
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates", trainingId] });
    },
  });
}

// ── file storage ─────────────────────────────────────────────────

export async function uploadTrainingFile(kind: "resources" | "certificates" | "documents", trainingId: string, file: File) {
  const path = `${kind}/${trainingId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("trainops-files").upload(path, file, { upsert: true });
  raise(error);
  const { data } = supabase.storage.from("trainops-files").getPublicUrl(path);
  return data.publicUrl;
}

// ── resources ────────────────────────────────────────────────────

export function useTrainingResources(trainingId: string) {
  return useQuery({
    queryKey: ["resources", trainingId],
    queryFn: async (): Promise<ResourceRow[]> => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false });
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export function useAddResource(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, scope }: { file: File; scope: string }) => {
      const fileUrl = await uploadTrainingFile("resources", trainingId, file);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("resources").insert({
        training_id: trainingId,
        name: file.name,
        file_url: fileUrl,
        scope,
        version: "v1",
        uploaded_by: user?.id ?? null,
      });
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", trainingId] });
    },
  });
}

// ── tests ────────────────────────────────────────────────────────

export function useTrainingTests(trainingId: string, phase: "pre" | "post") {
  return useQuery({
    queryKey: ["tests", trainingId, phase],
    queryFn: async (): Promise<TestRow[]> => {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("training_id", trainingId)
        .eq("phase", phase)
        .order("position", { ascending: true });
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

export interface TestQuestionInput {
  phase: "pre" | "post";
  question: string;
  options: { label: string; text: string }[];
  correct_option: string;
  position: number;
}

export function useAddTestQuestion(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TestQuestionInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("tests").insert({ ...input, training_id: trainingId, created_by: user?.id ?? null });
      raise(error);
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["tests", trainingId, input.phase] });
    },
  });
}

export function useDeleteTestQuestion(trainingId: string, phase: "pre" | "post") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tests").delete().eq("id", id);
      raise(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests", trainingId, phase] });
    },
  });
}

export function usePublishTestAttempts(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ phase, studentIds }: { phase: "pre" | "post"; studentIds: string[] }) => {
      if (studentIds.length === 0) return [] as TestAttemptRow[];
      const { data, error } = await supabase
        .from("test_attempts")
        .upsert(
          studentIds.map((studentId) => ({ training_id: trainingId, student_id: studentId, phase })),
          { onConflict: "training_id,student_id,phase" },
        )
        .select("*");
      raise(error);
      return data ?? [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-attempts", trainingId] });
    },
  });
}

export function useTestAttempts(trainingId: string, phase: "pre" | "post") {
  return useQuery({
    queryKey: ["test-attempts", trainingId, phase],
    queryFn: async (): Promise<TestAttemptRow[]> => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("training_id", trainingId)
        .eq("phase", phase);
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

// ── surveys ──────────────────────────────────────────────────────

export function useSurveyQuestions(level: "l1" | "l3") {
  return useQuery({
    queryKey: ["survey-questions", level],
    queryFn: async (): Promise<SurveyQuestionRow[]> => {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("level", level)
        .order("position", { ascending: true });
      raise(error);
      return data ?? [];
    },
  });
}

export function useSaveSurveyQuestions(level: "l1" | "l3") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questions: { en: string; fr: string; type: string }[]) => {
      const { error: deleteError } = await supabase.from("survey_questions").delete().eq("level", level);
      raise(deleteError);
      if (questions.length > 0) {
        const { error } = await supabase
          .from("survey_questions")
          .insert(questions.map((q, position) => ({ ...q, level, position })));
        raise(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-questions", level] });
    },
  });
}

export function useSendSurveys(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ level, studentIds }: { level: "l1" | "l3"; studentIds: string[] }) => {
      if (studentIds.length === 0) return [] as SurveyResponseRow[];
      const { data, error } = await supabase
        .from("survey_responses")
        .upsert(
          studentIds.map((studentId) => ({ training_id: trainingId, student_id: studentId, level })),
          { onConflict: "training_id,student_id,level" },
        )
        .select("*");
      raise(error);
      return data ?? [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-responses", trainingId] });
    },
  });
}

export function useSurveyResponses(trainingId: string, level: "l1" | "l3") {
  return useQuery({
    queryKey: ["survey-responses", trainingId, level],
    queryFn: async (): Promise<SurveyResponseRow[]> => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("training_id", trainingId)
        .eq("level", level);
      raise(error);
      return data ?? [];
    },
    enabled: !!trainingId,
  });
}

// ── profiles ─────────────────────────────────────────────────────

export function useProfilesByRole(role: AppRole) {
  return useQuery({
    queryKey: ["profiles", role],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", role)
        .order("full_name", { ascending: true });
      raise(error);
      return data ?? [];
    },
  });
}

// ── group insights (AI-generated, via the generate-group-insights edge function) ──

export interface GroupInsightsContent {
  strengths: string[];
  shared_gap: string;
  recommended_next_training: string;
  talking_points: string[];
}

export interface GroupInsightsRow {
  training_id: string;
  content: GroupInsightsContent;
  generated_at: string;
  status: "draft" | "published";
}

export function useGroupInsights(trainingId: string) {
  return useQuery({
    queryKey: ["group-insights", trainingId],
    queryFn: async (): Promise<GroupInsightsRow | null> => {
      const { data, error } = await supabase
        .from("group_insights")
        .select("training_id, content, generated_at, status")
        .eq("training_id", trainingId)
        .maybeSingle();
      raise(error);
      return data;
    },
    enabled: !!trainingId,
  });
}

export function useGenerateGroupInsights(trainingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GroupInsightsContent> => {
      const { data, error } = await supabase.functions.invoke("generate-group-insights", {
        body: { training_id: trainingId },
      });
      if (error) {
        let message = error.message;
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === "function") {
          try {
            const body = await context.json();
            if (body?.error) message = body.error;
          } catch {
            // no JSON body to read from — fall back to the generic error message
          }
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data.insights as GroupInsightsContent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-insights", trainingId] });
    },
  });
}
