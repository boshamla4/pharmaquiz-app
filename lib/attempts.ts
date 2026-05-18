import { randomUUID } from "node:crypto";
import { filterQuestionBank, getSections, sortQuestions } from "@/lib/questions";
import { formatScore, isFullyCorrect, scoreQuestion } from "@/lib/scoring";
import { getServiceSupabase } from "@/lib/supabase";
import type { AttemptQuestionRecord, QuestionSnapshot, QuizAttemptRecord } from "@/lib/quiz-types";

export interface StartAttemptOptions {
  sections: string[];
  questionTypes: Array<"single" | "multiple">;
  orderMode: "ordered" | "random";
  includeRepeated?: boolean;
  wrongOnly?: boolean;
  useAllQuestions: boolean;
  limit: number;
  timerMinutes: number | null;
  sourceAttemptId?: string;
  redoMode?: "all" | "wrong_only";
}

interface HistoryRow {
  question_id: string | null;
  question_snapshot: QuestionSnapshot | null;
  selected_answer_ids: string[] | null;
  is_correct: boolean | null;
}

function toQuestionRow(question: QuestionSnapshot) {
  return {
    id: question.id,
    section_name: question.section,
    question_number: question.question_number,
    source_order: question.source_order,
    question_text: question.question_text,
    question_type: question.type ?? "single",
    images: question.images ?? [],
    options: question.options,
    correct_answers: question.correct_answers,
    source_page: question.source_page ?? null,
    updated_at: new Date().toISOString(),
  };
}

function parseAttemptQuestion(row: {
  id: string;
  attempt_id: string;
  position: number;
  question_id: string | null;
  question_snapshot: QuestionSnapshot;
  selected_answer_ids: string[] | null;
  is_correct: boolean | null;
  score_weight: number | null;
}): AttemptQuestionRecord {
  return {
    id: row.id,
    attempt_id: row.attempt_id,
    position: row.position,
    question_id: row.question_id,
    question_snapshot: row.question_snapshot,
    selected_answer_ids: Array.isArray(row.selected_answer_ids) ? row.selected_answer_ids : [],
    is_correct: row.is_correct,
    score_weight: row.score_weight,
  };
}

function parseAttempt(row: Record<string, unknown>): QuizAttemptRecord {
  return {
    id: String(row.id),
    profile_id: String(row.profile_id),
    status: row.status === "submitted" ? "submitted" : "in_progress",
    mode: row.mode === "random" ? "random" : "ordered",
    timer_seconds: typeof row.timer_seconds === "number" ? row.timer_seconds : null,
    current_index: typeof row.current_index === "number" ? row.current_index : 0,
    answered_questions: typeof row.answered_questions === "number" ? row.answered_questions : 0,
    total_questions: typeof row.total_questions === "number" ? row.total_questions : 0,
    score: typeof row.score === "number" ? row.score : null,
    settings: typeof row.settings === "object" && row.settings ? (row.settings as Record<string, unknown>) : {},
    started_at: String(row.started_at),
    updated_at: String(row.updated_at),
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
  };
}

async function fetchRedoQuestions(profileId: string, sourceAttemptId: string, redoMode: "all" | "wrong_only"): Promise<QuestionSnapshot[]> {
  const db = getServiceSupabase();
  const { data: attemptRow, error: attemptError } = await db
    .from("quiz_attempts")
    .select("id")
    .eq("id", sourceAttemptId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (attemptError || !attemptRow) {
    throw new Error("Attempt not found.");
  }

  let query = db
    .from("attempt_questions")
    .select("question_snapshot, is_correct, position")
    .eq("attempt_id", sourceAttemptId)
    .order("position", { ascending: true });

  if (redoMode === "wrong_only") {
    query = query.eq("is_correct", false);
  }

  const { data: questionRows, error: questionError } = await query;
  if (questionError || !questionRows) {
    throw new Error("Failed to load attempt questions.");
  }

  return questionRows.map((row) => row.question_snapshot as QuestionSnapshot);
}

async function fetchAnswerHistory(profileId: string): Promise<{ answeredIds: Set<string>; wrongIds: Set<string> }> {
  const db = getServiceSupabase();
  const { data: attempts, error } = await db
    .from("quiz_attempts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "submitted");

  if (error) {
    throw new Error(`Failed to load attempt history: ${error.message}`);
  }

  const attemptIds = (attempts ?? []).map((attempt) => attempt.id).filter(Boolean);
  if (attemptIds.length === 0) {
    return { answeredIds: new Set(), wrongIds: new Set() };
  }

  const answeredIds = new Set<string>();
  const wrongIds = new Set<string>();
  const chunkSize = 50;

  for (let index = 0; index < attemptIds.length; index += chunkSize) {
    const chunk = attemptIds.slice(index, index + chunkSize);
    const { data: rows, error: rowsError } = await db
      .from("attempt_questions")
      .select("question_id, question_snapshot, selected_answer_ids, is_correct")
      .in("attempt_id", chunk);

    if (rowsError) {
      throw new Error(`Failed to load attempt question history: ${rowsError.message}`);
    }

    for (const row of (rows ?? []) as HistoryRow[]) {
      const snapshotId = row.question_snapshot?.id;
      const questionId = row.question_id ?? (typeof snapshotId === "string" ? snapshotId : null);
      if (!questionId) continue;

      const selected = Array.isArray(row.selected_answer_ids) ? row.selected_answer_ids : [];
      if (selected.length > 0) {
        answeredIds.add(questionId);
      }
      if (row.is_correct === false) {
        wrongIds.add(questionId);
      }
    }
  }

  return { answeredIds, wrongIds };
}

async function applyHistoryFilters(
  profileId: string,
  questions: QuestionSnapshot[],
  options: { includeRepeated?: boolean; wrongOnly?: boolean },
): Promise<QuestionSnapshot[]> {
  if (!options.wrongOnly && options.includeRepeated !== false) {
    return questions;
  }

  const { answeredIds, wrongIds } = await fetchAnswerHistory(profileId);

  if (options.wrongOnly) {
    return questions.filter((question) => wrongIds.has(question.id));
  }

  return questions.filter((question) => !answeredIds.has(question.id));
}

async function persistQuestions(questions: QuestionSnapshot[]): Promise<void> {
  const db = getServiceSupabase();
  const uniqueRows = Array.from(new Map(questions.map((question) => [question.id, toQuestionRow(question)])).values());
  if (uniqueRows.length === 0) return;

  const { error } = await db.from("questions").upsert(uniqueRows, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to persist question bank rows: ${error.message}`);
  }
}

export async function createAttempt(profileId: string, options: StartAttemptOptions): Promise<string> {
  const db = getServiceSupabase();
  const sourceQuestions = options.sourceAttemptId
    ? await fetchRedoQuestions(profileId, options.sourceAttemptId, options.redoMode ?? "all")
    : await applyHistoryFilters(
        profileId,
        filterQuestionBank({ sections: options.sections, questionTypes: options.questionTypes }),
        { includeRepeated: options.includeRepeated, wrongOnly: options.wrongOnly },
      );

  const sortedQuestions = sortQuestions(sourceQuestions, options.orderMode);
  const selectedQuestions = options.useAllQuestions ? sortedQuestions : sortedQuestions.slice(0, options.limit);

  if (selectedQuestions.length === 0) {
    throw new Error("No questions matched the selected filters.");
  }

  await persistQuestions(selectedQuestions);

  const now = new Date().toISOString();
  const { data: attemptRow, error: attemptError } = await db
    .from("quiz_attempts")
    .insert({
      id: randomUUID(),
      profile_id: profileId,
      status: "in_progress",
      mode: options.orderMode,
      timer_seconds: options.timerMinutes ? options.timerMinutes * 60 : null,
      current_index: 0,
      answered_questions: 0,
      total_questions: selectedQuestions.length,
      settings: {
        sections: options.sections,
        questionTypes: options.questionTypes,
        includeRepeated: options.includeRepeated ?? true,
        wrongOnly: options.wrongOnly ?? false,
        useAllQuestions: options.useAllQuestions,
        limit: options.useAllQuestions ? selectedQuestions.length : options.limit,
        redoMode: options.redoMode ?? null,
        sourceAttemptId: options.sourceAttemptId ?? null,
      },
      started_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (attemptError || !attemptRow) {
    throw new Error(`Failed to create attempt: ${attemptError?.message ?? "unknown error"}`);
  }

  const { error: questionError } = await db.from("attempt_questions").insert(
    selectedQuestions.map((question, index) => ({
      id: randomUUID(),
      attempt_id: attemptRow.id,
      position: index,
      question_id: question.id,
      question_snapshot: question,
      selected_answer_ids: [],
    })),
  );

  if (questionError) {
    throw new Error(`Failed to create attempt questions: ${questionError.message}`);
  }

  return String(attemptRow.id);
}

export async function getAttempt(profileId: string, attemptId: string): Promise<{
  attempt: QuizAttemptRecord;
  questions: AttemptQuestionRecord[];
} | null> {
  const db = getServiceSupabase();
  const { data: attemptRow, error: attemptError } = await db
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (attemptError || !attemptRow) return null;

  const { data: questionRows, error: questionError } = await db
    .from("attempt_questions")
    .select("id, attempt_id, position, question_id, question_snapshot, selected_answer_ids, is_correct, score_weight")
    .eq("attempt_id", attemptId)
    .order("position", { ascending: true });

  if (questionError || !questionRows) return null;

  return {
    attempt: parseAttempt(attemptRow),
    questions: questionRows.map((row) => parseAttemptQuestion(row as never)),
  };
}

export async function saveAttemptProgress(
  profileId: string,
  attemptId: string,
  currentIndex: number,
  answers: Array<{ attemptQuestionId: string; selectedAnswerIds: string[] }>,
): Promise<void> {
  const db = getServiceSupabase();
  const attempt = await getAttempt(profileId, attemptId);
  if (!attempt) {
    throw new Error("Attempt not found.");
  }
  if (attempt.attempt.status !== "in_progress") {
    throw new Error("Attempt has already been submitted.");
  }

  // Only update rows whose answers actually changed — avoids N parallel writes for unchanged questions
  const existingById = new Map(attempt.questions.map((q) => [q.id, q.selected_answer_ids]));
  const changed = answers.filter((entry) => {
    const prev = existingById.get(entry.attemptQuestionId) ?? [];
    if (prev.length !== entry.selectedAnswerIds.length) return true;
    return entry.selectedAnswerIds.some((id) => !prev.includes(id));
  });

  if (changed.length > 0) {
    await Promise.all(
      changed.map((entry) =>
        db
          .from("attempt_questions")
          .update({ selected_answer_ids: entry.selectedAnswerIds })
          .eq("id", entry.attemptQuestionId)
          .eq("attempt_id", attemptId),
      ),
    );
  }

  // Compute answered count from the merged in-memory + changed state (no extra DB round-trip)
  const mergedAnswers = new Map(existingById);
  for (const entry of changed) {
    mergedAnswers.set(entry.attemptQuestionId, entry.selectedAnswerIds);
  }
  const answeredQuestions = [...mergedAnswers.values()].filter((ids) => ids.length > 0).length;

  const { error } = await db
    .from("quiz_attempts")
    .update({
      current_index: currentIndex,
      answered_questions: answeredQuestions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(`Failed to save attempt progress: ${error.message}`);
  }
}

export async function submitAttempt(profileId: string, attemptId: string): Promise<{ score: number; total: number }> {
  const db = getServiceSupabase();
  const attempt = await getAttempt(profileId, attemptId);
  if (!attempt) {
    throw new Error("Attempt not found.");
  }
  if (attempt.attempt.status !== "in_progress") {
    return {
      score: attempt.attempt.score ?? 0,
      total: attempt.attempt.total_questions,
    };
  }

  // Score all questions in memory first, then batch-upsert in one round-trip
  let totalScore = 0;
  const scoredRows = attempt.questions.map((question) => {
    const score = scoreQuestion(question.question_snapshot, question.selected_answer_ids);
    totalScore += score;
    return {
      id: question.id,
      attempt_id: question.attempt_id,
      position: question.position,
      question_id: question.question_id,
      question_snapshot: question.question_snapshot,
      selected_answer_ids: question.selected_answer_ids,
      is_correct: isFullyCorrect(question.question_snapshot, question.selected_answer_ids),
      score_weight: Number(score.toFixed(2)),
    };
  });

  const { error: scoreError } = await db.from("attempt_questions").upsert(scoredRows, { onConflict: "id" });
  if (scoreError) {
    throw new Error(`Failed to score attempt questions: ${scoreError.message}`);
  }

  const roundedScore = Number(totalScore.toFixed(2));
  const { error } = await db
    .from("quiz_attempts")
    .update({
      status: "submitted",
      score: roundedScore,
      submitted_at: new Date().toISOString(),
      answered_questions: attempt.questions.filter((entry) => entry.selected_answer_ids.length > 0).length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(`Failed to finalize attempt: ${error.message}`);
  }

  return { score: roundedScore, total: attempt.questions.length };
}

export async function getDashboardData(profileId: string): Promise<{
  inProgress: QuizAttemptRecord[];
  recentHistory: QuizAttemptRecord[];
  completedCount: number;
  averageScore: string;
}> {
  const db = getServiceSupabase();
  const { data: attemptRows, error } = await db
    .from("quiz_attempts")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (error || !attemptRows) {
    throw new Error(`Failed to load dashboard data: ${error?.message ?? "unknown error"}`);
  }

  const attempts = attemptRows.map((row) => parseAttempt(row));
  const completed = attempts.filter((attempt) => attempt.status === "submitted");
  const totalScore = completed.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0);
  const averageScore = completed.length > 0 ? formatScore(totalScore / completed.length) : "0";

  return {
    inProgress: attempts.filter((attempt) => attempt.status === "in_progress"),
    recentHistory: completed.slice(0, 8),
    completedCount: completed.length,
    averageScore,
  };
}

export async function getAttemptHistory(profileId: string): Promise<QuizAttemptRecord[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from("quiz_attempts")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    throw new Error(`Failed to load attempt history: ${error?.message ?? "unknown error"}`);
  }

  return data.map((row) => parseAttempt(row));
}

export function getAvailableSections() {
  return getSections();
}

export async function getAttemptPreview(
  profileId: string,
  options: {
    sections: string[];
    questionTypes: Array<"single" | "multiple">;
    includeRepeated?: boolean;
    wrongOnly?: boolean;
    useAllQuestions: boolean;
    limit: number;
  },
): Promise<{
  totalMatchingBeforeHistory: number;
  totalAvailable: number;
  plannedQuestionCount: number;
  sectionRows: Array<{ section: string; total_questions: number; available_questions: number }>;
}> {
  const allQuestions = filterQuestionBank({ sections: options.sections, questionTypes: options.questionTypes });
  const filtered = await applyHistoryFilters(profileId, allQuestions, {
    includeRepeated: options.includeRepeated,
    wrongOnly: options.wrongOnly,
  });

  const totalBySection = new Map<string, number>();
  const availableBySection = new Map<string, number>();

  for (const question of allQuestions) {
    totalBySection.set(question.section, (totalBySection.get(question.section) ?? 0) + 1);
  }

  for (const question of filtered) {
    availableBySection.set(question.section, (availableBySection.get(question.section) ?? 0) + 1);
  }

  const sections = new Set([...totalBySection.keys(), ...availableBySection.keys()]);
  const sectionRows = [...sections]
    .map((section) => ({
      section,
      total_questions: totalBySection.get(section) ?? 0,
      available_questions: availableBySection.get(section) ?? 0,
    }))
    .sort((left, right) => left.section.localeCompare(right.section));

  const totalAvailable = filtered.length;
  const plannedQuestionCount = options.useAllQuestions ? totalAvailable : Math.min(options.limit, totalAvailable);

  return {
    totalMatchingBeforeHistory: allQuestions.length,
    totalAvailable,
    plannedQuestionCount,
    sectionRows,
  };
}
