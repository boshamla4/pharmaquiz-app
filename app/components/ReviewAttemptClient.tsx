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
  const [index, setIndex] = useState(0);
  const [pendingRedo, setPendingRedo] = useState<"all" | "wrong_only" | null>(null);
  const activeQuestion = questions[index];

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

  if (!activeQuestion) {
    return <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">No reviewable questions were found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-800">Reviewing submitted test</p>
          <p className="text-sm text-gray-600">
            Score {formatScore(attempt.score ?? 0)} / {attempt.total_questions}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void redo("all")}
            disabled={pendingRedo !== null}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            {pendingRedo === "all" ? "Creating…" : "Redo all"}
          </button>
          <button
            type="button"
            onClick={() => void redo("wrong_only")}
            disabled={pendingRedo !== null}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pendingRedo === "wrong_only" ? "Creating…" : "Redo wrong only"}
          </button>
        </div>
      </div>

      <QuestionCard
        question={activeQuestion.question_snapshot}
        selectedIds={activeQuestion.selected_answer_ids}
        showResults
        disabled
        scoreWeight={activeQuestion.score_weight}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          ← Previous
        </button>
        <p className="text-sm text-gray-600">
          Question {index + 1} / {questions.length}
        </p>
        <button
          type="button"
          onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
          disabled={index === questions.length - 1}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
