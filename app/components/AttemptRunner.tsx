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
    () => Object.fromEntries(questions.map((q) => [q.id, q.selected_answer_ids ?? []])),
    [questions],
  );

  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);
  const [index, setIndex] = useState(attempt.current_index);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(initialRemainingSeconds);
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Refs so background save always sees latest values without re-creating callbacks
  const answersRef = useRef(answers);
  const indexRef = useRef(index);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const autoSaveRef = useRef<number | null>(null);

  const activeQuestion = questions[index];

  function updateSelection(optionId: string, checked: boolean) {
    const isMultiple = (activeQuestion.question_snapshot.type ?? "single") === "multiple";
    setAnswers((prev) => {
      const current = prev[activeQuestion.id] ?? [];
      if (!isMultiple) return { ...prev, [activeQuestion.id]: checked ? [optionId] : [] };
      const next = new Set(current);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return { ...prev, [activeQuestion.id]: Array.from(next) };
    });
    if (!isMultiple) {
      setRevealedSet((prev) => new Set([...prev, activeQuestion.id]));
    }
  }

  function revealCurrentQuestion() {
    setRevealedSet((prev) => new Set([...prev, activeQuestion.id]));
  }

  // Background auto-save — never touches `pending`, completely silent
  const backgroundSave = useCallback(async () => {
    const payload = {
      currentIndex: indexRef.current,
      answers: questions.map((q) => ({
        attemptQuestionId: q.id,
        selectedAnswerIds: answersRef.current[q.id] ?? [],
      })),
    };
    await fetch(`/api/attempts/${attempt.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null); // swallow errors silently
  }, [attempt.id, questions]);

  // Explicit save — blocks UI so user knows the action completed
  const explicitSave = useCallback(async (): Promise<boolean> => {
    setPending(true);
    setSubmitError(null);
    const payload = {
      currentIndex: indexRef.current,
      answers: questions.map((q) => ({
        attemptQuestionId: q.id,
        selectedAnswerIds: answersRef.current[q.id] ?? [],
      })),
    };
    const response = await fetch(`/api/attempts/${attempt.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setSubmitError(body?.error ?? "Failed to save. Please try again.");
      setPending(false);
      return false;
    }
    setPending(false);
    return true;
  }, [attempt.id, questions]);

  const submitAttempt = useCallback(async () => {
    setPending(true);
    setSubmitError(null);
    const saveOk = await explicitSave();
    if (!saveOk) return;

    const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setSubmitError(body?.error ?? "Failed to submit. Please try again.");
      setPending(false);
      return;
    }
    setNavigating(true);
    router.replace(`/review/${attempt.id}`);
    router.refresh();
  }, [attempt.id, explicitSave, router]);

  // Timer
  useEffect(() => {
    if (attempt.timer_seconds === null) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((v) => {
        if (v === null) return v;
        if (v <= 1) { window.clearInterval(interval); void submitAttempt(); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [attempt.timer_seconds, submitAttempt]);

  // Background auto-save — 4 s debounce, never blocks UI
  useEffect(() => {
    if (autoSaveRef.current) window.clearTimeout(autoSaveRef.current);
    autoSaveRef.current = window.setTimeout(() => void backgroundSave(), 4000);
    return () => { if (autoSaveRef.current) window.clearTimeout(autoSaveRef.current); };
  }, [answers, index, backgroundSave]);

  if (!activeQuestion) {
    return (
      <p className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400">
        This attempt does not contain any questions.
      </p>
    );
  }

  const answeredCount = Object.values(answers).filter((e) => e.length > 0).length;
  const unanswered = questions.length - answeredCount;
  const progressPct = Math.round((answeredCount / questions.length) * 100);
  const isRevealed = revealedSet.has(activeQuestion.id);
  const isMultipleActive = (activeQuestion.question_snapshot.type ?? "single") === "multiple";
  const currentAnswers = answers[activeQuestion.id] ?? [];

  return (
    <>
      <div className="space-y-4">
        {/* Progress header */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Question {index + 1} <span className="font-normal text-gray-400">of {questions.length}</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{answeredCount} answered · {progressPct}%</p>
            </div>
            <div className="text-right text-xs">
              {remainingSeconds !== null ? (
                <span className={`font-mono font-semibold text-sm ${remainingSeconds < 300 ? "text-red-500" : "text-gray-600 dark:text-gray-300"}`}>
                  {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
                </span>
              ) : (
                <span className="capitalize text-gray-400 dark:text-gray-500">{attempt.mode}</span>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-1.5 rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <QuestionCard
          question={activeQuestion.question_snapshot}
          selectedIds={currentAnswers}
          showResults={isRevealed}
          disabled={isRevealed}
          onToggle={isRevealed ? undefined : updateSelection}
          shuffleSeed={`${attempt.id}:${activeQuestion.id}`}
        />

        {isMultipleActive && !isRevealed && currentAnswers.length > 0 && (
          <button
            type="button"
            onClick={revealCurrentQuestion}
            className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            Check answer
          </button>
        )}

        {submitError ? (
          <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
            {submitError}
          </p>
        ) : null}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIndex((v) => Math.max(0, v - 1))}
            disabled={index === 0}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            ← Previous
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => { const ok = await explicitSave(); if (ok) router.push("/dashboard"); }}
              disabled={pending}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Save & exit
            </button>
            <button
              type="button"
              onClick={() => {
                if (unanswered > 0) setShowSubmitModal(true);
                else void submitAttempt();
              }}
              disabled={pending}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              {pending ? "Submitting…" : "Submit test"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIndex((v) => Math.min(questions.length - 1, v + 1))}
            disabled={index === questions.length - 1}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Full-screen loading overlay while navigating to results */}
      {navigating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Loading results…</p>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Finish test early?</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You have answered <strong className="text-gray-900 dark:text-gray-100">{answeredCount}</strong> of{" "}
              <strong className="text-gray-900 dark:text-gray-100">{questions.length}</strong> questions.{" "}
              <strong className="text-amber-600 dark:text-amber-400">{unanswered} unanswered</strong>{" "}
              {unanswered === 1 ? "question" : "questions"} will be marked wrong.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => { setShowSubmitModal(false); void submitAttempt(); }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
