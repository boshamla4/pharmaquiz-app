"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/app/components/QuestionCard";
import { formatScore } from "@/lib/scoring";
import type { AttemptQuestionRecord, QuizAttemptRecord } from "@/lib/quiz-types";

export default function ReviewAttemptClient({
  attempt,
  questions,
}: {
  attempt: QuizAttemptRecord;
  questions: AttemptQuestionRecord[];
}) {
  const router = useRouter();
  const [pendingRedo, setPendingRedo] = useState<"all" | "wrong_only" | null>(null);

  async function redo(filter: "all" | "wrong_only") {
    setPendingRedo(filter);
    const response = await fetch("/api/attempts/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAttemptId: attempt.id,
        redoMode: filter,
        orderMode: "ordered",
        useAllQuestions: true,
        sections: [],
        questionTypes: [],
      }),
    });
    const payload = (await response.json().catch(() => null)) as { attemptId?: string; error?: string } | null;
    if (response.ok && payload?.attemptId) {
      router.push(`/attempt/${payload.attemptId}`);
      router.refresh();
      return;
    }
    setPendingRedo(null);
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400">
        No reviewable questions were found.
      </p>
    );
  }

  const score = attempt.score ?? 0;
  const total = attempt.total_questions;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const wrongCount = questions.filter((q) => {
    const correct = q.question_snapshot.correct_answers;
    const selected = q.selected_answer_ids ?? [];
    return !(
      correct.length === selected.length &&
      correct.every((id) => selected.includes(id))
    );
  }).length;

  return (
    <div className="space-y-5">
      {/* Score header — sticky on scroll */}
      <div className="sticky top-0 z-10 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Final score</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatScore(score)}
              <span className="ml-1 text-lg font-normal text-gray-400">/ {total}</span>
            </p>
            <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-2 rounded-full transition-all ${pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {pct}% · {wrongCount} wrong
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void redo("all")}
              disabled={pendingRedo !== null}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {pendingRedo === "all" ? "Creating…" : "Redo all"}
            </button>
            <button
              type="button"
              onClick={() => void redo("wrong_only")}
              disabled={pendingRedo !== null}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              {pendingRedo === "wrong_only" ? "Creating…" : `Redo wrong (${wrongCount})`}
            </button>
          </div>
        </div>
      </div>

      {/* All questions */}
      {questions.map((q, i) => (
        <div key={q.id}>
          <p className="mb-2 text-xs font-medium text-gray-400 dark:text-gray-500 px-1">
            {i + 1} / {questions.length}
          </p>
          <QuestionCard
            question={q.question_snapshot}
            selectedIds={q.selected_answer_ids ?? []}
            showResults
            disabled
            scoreWeight={q.score_weight}
          />
        </div>
      ))}
    </div>
  );
}
