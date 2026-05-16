"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/app/components/QuestionCard";
import type { AttemptQuestionRecord, QuizAttemptRecord } from "@/lib/quiz-types";

interface AttemptRunnerProps {
  attempt: QuizAttemptRecord;
  questions: AttemptQuestionRecord[];
  initialRemainingSeconds: number | null;
}

export default function AttemptRunner({ attempt, questions, initialRemainingSeconds }: AttemptRunnerProps) {
  const router = useRouter();
  const initialAnswers = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question.selected_answer_ids ?? []])),
    [questions],
  );
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);
  const [index, setIndex] = useState(attempt.current_index);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(initialRemainingSeconds);
  const autoSaveRef = useRef<number | null>(null);

  const activeQuestion = questions[index];

  function updateSelection(optionId: string, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[activeQuestion.id] ?? [];
      const isMultiple = (activeQuestion.question_snapshot.type ?? "single") === "multiple";

      if (!isMultiple) {
        return { ...prev, [activeQuestion.id]: checked ? [optionId] : [] };
      }

      const next = new Set(current);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return { ...prev, [activeQuestion.id]: Array.from(next) };
    });
  }

  const handleSaveProgress = useCallback(async (nextIndex: number, message = "Progress saved.") => {
    setPending(true);
    const payload = {
      currentIndex: nextIndex,
      answers: questions.map((question) => ({
        attemptQuestionId: question.id,
        selectedAnswerIds: answers[question.id] ?? [],
      })),
    };

    const response = await fetch(`/api/attempts/${attempt.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setStatus(body?.error ?? "Failed to save progress.");
      setPending(false);
      return false;
    }

    setStatus(message);
    setPending(false);
    return true;
  }, [answers, attempt.id, questions]);

  const submitAttempt = useCallback(async () => {
    setPending(true);
    const saveOk = await handleSaveProgress(index, "Submitting test…");
    if (!saveOk) return;

    const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatus(body?.error ?? "Failed to submit the test.");
      setPending(false);
      return;
    }

    router.replace(`/review/${attempt.id}`);
    router.refresh();
  }, [attempt.id, index, router, handleSaveProgress]);

  useEffect(() => {
    if (attempt.timer_seconds === null) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((value) => {
        if (value === null) return value;
        if (value <= 1) {
          window.clearInterval(interval);
          void submitAttempt();
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [attempt.timer_seconds, submitAttempt]);

  useEffect(() => {
    if (autoSaveRef.current) {
      window.clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = window.setTimeout(() => {
      void handleSaveProgress(index, "Progress auto-saved.");
    }, 2500);

    return () => {
      if (autoSaveRef.current) window.clearTimeout(autoSaveRef.current);
    };
  }, [answers, index, handleSaveProgress]);

  if (!activeQuestion) {
    return <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">This attempt does not contain any questions.</p>;
  }

  const answeredCount = Object.values(answers).filter((entry) => entry.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Question {index + 1} / {questions.length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{answeredCount} answered</p>
        </div>
        <div className="text-right text-sm text-gray-600 dark:text-gray-400">
          <p>Mode: {attempt.mode === "ordered" ? "Ordered" : "Random"}</p>
          <p>{remainingSeconds !== null ? `Time left: ${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s` : "No timer"}</p>
        </div>
      </div>

      <QuestionCard
        question={activeQuestion.question_snapshot}
        selectedIds={answers[activeQuestion.id] ?? []}
        onToggle={updateSelection}
      />

      {status ? <p className="rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">{status}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0 || pending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          ← Previous
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSaveProgress(index, "Progress saved. You can continue later from the dashboard.")}
            disabled={pending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Save & continue later
          </button>
          <button
            type="button"
            onClick={() => void submitAttempt()}
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Submit test
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
          disabled={index === questions.length - 1 || pending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
