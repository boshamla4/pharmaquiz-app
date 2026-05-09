import { getQuestionBank } from "@/lib/questions";
import { getServiceSupabase } from "@/lib/supabase";

export type StatsMode = "last" | "all";

export interface SectionStatsRow {
  section: string;
  answered_count: number;
  correct_count: number;
  partial_sum: number;
  total_questions: number;
  score: number;
  consistency: number;
  coverage: number;
  low_confidence: boolean;
}

interface AttemptQuestionStatRow {
  attempt_id: string;
  question_id: string | null;
  question_snapshot: { section?: string; id?: string } | null;
  selected_answer_ids: string[] | null;
  score_weight: number | null;
  is_correct: boolean | null;
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}

function dedupeRows(rows: AttemptQuestionStatRow[], mode: StatsMode): AttemptQuestionStatRow[] {
  if (mode === "last") return rows;

  const seen = new Set<string>();
  const deduped: AttemptQuestionStatRow[] = [];

  for (const row of rows) {
    const snapshot = row.question_snapshot ?? {};
    const key = row.question_id ?? snapshot.id ?? `${snapshot.section ?? "Unknown"}::${JSON.stringify(snapshot)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

export async function getAttemptSectionStats(profileId: string, mode: StatsMode): Promise<{
  mode: StatsMode;
  examCount: number;
  stats: SectionStatsRow[];
}> {
  const db = getServiceSupabase();
  const { data: attempts, error: attemptsError } = await db
    .from("quiz_attempts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  if (attemptsError || !attempts) {
    throw new Error(`Failed to load submitted attempts: ${attemptsError?.message ?? "unknown error"}`);
  }

  if (attempts.length === 0) {
    return { mode, examCount: 0, stats: [] };
  }

  const attemptIds = mode === "last" ? [attempts[0].id] : attempts.map((attempt) => attempt.id);
  const attemptRank = new Map(attemptIds.map((attemptId, index) => [attemptId, index]));

  const { data: rows, error: rowsError } = await db
    .from("attempt_questions")
    .select("attempt_id, question_id, question_snapshot, selected_answer_ids, score_weight, is_correct")
    .in("attempt_id", attemptIds)
    .order("position", { ascending: true });

  if (rowsError || !rows) {
    throw new Error(`Failed to load attempt question stats: ${rowsError?.message ?? "unknown error"}`);
  }

  const sortedRows = [...(rows as AttemptQuestionStatRow[])].sort(
    (left, right) => (attemptRank.get(left.attempt_id) ?? Number.MAX_SAFE_INTEGER) - (attemptRank.get(right.attempt_id) ?? Number.MAX_SAFE_INTEGER),
  );

  const totalsBySection = new Map<string, number>();
  for (const question of getQuestionBank()) {
    totalsBySection.set(question.section, (totalsBySection.get(question.section) ?? 0) + 1);
  }

  const aggregate = new Map<string, { answered_count: number; correct_count: number; partial_sum: number }>();
  for (const row of dedupeRows(sortedRows, mode)) {
    const section = row.question_snapshot?.section ?? "Unknown";
    const selected = Array.isArray(row.selected_answer_ids) ? row.selected_answer_ids : [];
    if (selected.length === 0) continue;

    const score = typeof row.score_weight === "number" ? row.score_weight : row.is_correct ? 1 : 0;
    const entry = aggregate.get(section) ?? { answered_count: 0, correct_count: 0, partial_sum: 0 };
    entry.answered_count += 1;
    entry.partial_sum += score;
    if (score === 1) entry.correct_count += 1;
    aggregate.set(section, entry);
  }

  const sections = new Set([...totalsBySection.keys(), ...aggregate.keys()]);
  const stats = [...sections]
    .map((section): SectionStatsRow => {
      const agg = aggregate.get(section) ?? { answered_count: 0, correct_count: 0, partial_sum: 0 };
      const total = totalsBySection.get(section) ?? 0;
      return {
        section,
        answered_count: agg.answered_count,
        correct_count: agg.correct_count,
        partial_sum: round(agg.partial_sum),
        total_questions: total,
        score: round(total > 0 ? agg.partial_sum / total : 0),
        consistency: round(agg.answered_count > 0 ? agg.correct_count / agg.answered_count : 0),
        coverage: round(total > 0 ? agg.answered_count / total : 0),
        low_confidence: agg.answered_count > 0 && agg.answered_count < 3,
      };
    })
    .sort((left, right) => left.section.localeCompare(right.section));

  return {
    mode,
    examCount: attemptIds.length,
    stats,
  };
}

export async function getActiveUsers(windowMinutes: number): Promise<{
  activeUsers: number;
  activeSessions: number;
  windowMinutes: number;
  asOf: string;
}> {
  const db = getServiceSupabase();
  const effectiveWindow = Math.max(1, Math.floor(windowMinutes));
  const nowIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - effectiveWindow * 60_000).toISOString();

  const { data, error } = await db
    .from("user_sessions")
    .select("profile_id")
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .gte("last_seen", windowStartIso);

  if (error) {
    throw new Error(`Failed to load active user count: ${error.message}`);
  }

  const uniqueProfiles = new Set((data ?? []).map((row) => row.profile_id).filter((value): value is string => typeof value === "string"));
  return {
    activeUsers: uniqueProfiles.size,
    activeSessions: data?.length ?? 0,
    windowMinutes: effectiveWindow,
    asOf: nowIso,
  };
}

export async function createFeedback(profileId: string, comment: string, whatsapp?: string | null): Promise<void> {
  const db = getServiceSupabase();
  const { error } = await db.from("feedback_comments").insert({
    profile_id: profileId,
    comment: comment.trim(),
    whatsapp: whatsapp?.trim() || null,
  });

  if (error) {
    throw new Error(`Failed to save feedback: ${error.message}`);
  }
}
