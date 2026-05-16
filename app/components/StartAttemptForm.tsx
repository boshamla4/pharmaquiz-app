"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SectionOption {
  name: string;
  count: number;
}

function shortName(name: string): string {
  return name
    .replace(/\s*department\s*/i, "")
    .replace(/\s*of\s+/i, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

export default function StartAttemptForm({ sections }: { sections: SectionOption[] }) {
  const router = useRouter();
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [questionTypes, setQuestionTypes] = useState<Array<"single" | "multiple">>([]);
  const [orderMode, setOrderMode] = useState<"ordered" | "random">("ordered");
  const [includeRepeated, setIncludeRepeated] = useState(true);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [useAllQuestions, setUseAllQuestions] = useState(false);
  const [limit, setLimit] = useState(25);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    totalMatchingBeforeHistory: number;
    totalAvailable: number;
    plannedQuestionCount: number;
  } | null>(null);

  function toggleSection(name: string) {
    setSelectedSections((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  function toggleType(type: "single" | "multiple") {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/attempts/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sections: selectedSections,
        questionTypes,
        orderMode,
        includeRepeated,
        wrongOnly,
        useAllQuestions,
        limit,
        timerMinutes: timerMinutes > 0 ? timerMinutes : null,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; attemptId?: string } | null;
    if (!response.ok || !payload?.attemptId) {
      setError(payload?.error ?? "Unable to start the test.");
      setPending(false);
      return;
    }

    router.push(`/attempt/${payload.attemptId}`);
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      const response = await fetch("/api/attempts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: selectedSections,
          questionTypes,
          includeRepeated,
          wrongOnly,
          useAllQuestions,
          limit,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { totalMatchingBeforeHistory: number; totalAvailable: number; plannedQuestionCount: number }
        | null;

      if (!cancelled && response.ok && payload) {
        setPreview(payload);
      }
      if (!cancelled) setPreviewLoading(false);
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedSections, questionTypes, includeRepeated, wrongOnly, useAllQuestions, limit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sections */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sections <span className="normal-case font-normal text-gray-400">(all if none selected)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => {
            const active = selectedSections.includes(section.name);
            return (
              <button
                key={section.name}
                type="button"
                onClick={() => toggleSection(section.name)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-teal-600 text-white"
                    : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-700"
                }`}
                title={`${section.name} (${section.count})`}
              >
                {shortName(section.name)} ({section.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Question types */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Type <span className="normal-case font-normal">(all if none selected)</span>
          </p>
          <div className="flex gap-2">
            {(["single", "multiple"] as const).map((type) => {
              const active = questionTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    active
                      ? "bg-teal-600 text-white"
                      : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delivery mode */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Delivery</p>
          <div className="flex gap-2">
            {(["ordered", "random"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOrderMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  orderMode === mode
                    ? "bg-teal-600 text-white"
                    : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* History filters */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">History</p>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRepeated}
                onChange={(e) => setIncludeRepeated(e.target.checked || wrongOnly)}
                disabled={wrongOnly}
                className="accent-teal-600"
              />
              Allow repeated questions
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wrongOnly}
                onChange={(e) => {
                  setWrongOnly(e.target.checked);
                  if (e.target.checked) setIncludeRepeated(true);
                }}
                className="accent-teal-600"
              />
              Wrong answers only
            </label>
          </div>
        </div>

        {/* Quantity & timer */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Quantity</p>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useAllQuestions}
              onChange={(e) => setUseAllQuestions(e.target.checked)}
              className="accent-teal-600"
            />
            Use all matching
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400 dark:text-gray-500">Limit</label>
              <input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 1)}
                disabled={useAllQuestions}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-40"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400 dark:text-gray-500">Timer (min)</label>
              <input
                type="number"
                min={0}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {previewLoading ? (
          <p>Calculating…</p>
        ) : preview ? (
          <div className="flex flex-wrap gap-4">
            <span><strong className="text-gray-700 dark:text-gray-200">{preview.totalMatchingBeforeHistory}</strong> matched</span>
            <span><strong className="text-gray-700 dark:text-gray-200">{preview.totalAvailable}</strong> available</span>
            <span><strong className="text-teal-600 dark:text-teal-400">{preview.plannedQuestionCount}</strong> in this test</span>
          </div>
        ) : (
          <p>Select filters above to preview question count.</p>
        )}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Starting…" : "Start test"}
      </button>
    </form>
  );
}
