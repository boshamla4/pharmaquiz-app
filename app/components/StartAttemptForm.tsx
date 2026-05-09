"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SectionOption {
  name: string;
  count: number;
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

  function toggleListValue<T extends string>(value: T, current: T[], setter: (next: T[]) => void) {
    if (current.includes(value)) {
      setter(current.filter((entry) => entry !== value));
      return;
    }

    setter([...current, value]);
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
      if (!cancelled) {
        setPreviewLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedSections, questionTypes, includeRepeated, wrongOnly, useAllQuestions, limit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="rounded-2xl border border-gray-200 p-4">
          <legend className="px-2 text-sm font-semibold text-gray-700">Categories / sections</legend>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {sections.map((section) => (
              <label key={section.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedSections.includes(section.name)}
                  onChange={() => toggleListValue(section.name, selectedSections, setSelectedSections)}
                />
                <span>
                  {section.name} ({section.count})
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-5">
          <fieldset className="rounded-2xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">Question types</legend>
            <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
              {(["single", "multiple"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 capitalize">
                  <input
                    type="checkbox"
                    checked={questionTypes.includes(type)}
                    onChange={() => toggleListValue(type, questionTypes, setQuestionTypes)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">Question delivery mode</legend>
            <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="radio" checked={orderMode === "ordered"} onChange={() => setOrderMode("ordered")} />
                Ordered questions (PDF section order)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={orderMode === "random"} onChange={() => setOrderMode("random")} />
                Randomized questions
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">History filters</legend>
            <div className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeRepeated}
                  onChange={(event) => setIncludeRepeated(event.target.checked || wrongOnly)}
                  disabled={wrongOnly}
                />
                Allow previously answered questions
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wrongOnly}
                  onChange={(event) => {
                    setWrongOnly(event.target.checked);
                    if (event.target.checked) {
                      setIncludeRepeated(true);
                    }
                  }}
                />
                Only previously wrong questions
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
          <span className="mb-2 block font-semibold">Use all matching questions</span>
          <input type="checkbox" checked={useAllQuestions} onChange={(event) => setUseAllQuestions(event.target.checked)} />
        </label>

        <label className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
          <span className="mb-2 block font-semibold">Question limit</span>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value) || 1)}
            disabled={useAllQuestions}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
          <span className="mb-2 block font-semibold">Timer (minutes)</span>
          <input
            type="number"
            min={0}
            value={timerMinutes}
            onChange={(event) => setTimerMinutes(Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        {previewLoading ? (
          <p>Calculating available questions…</p>
        ) : preview ? (
          <>
            <p>Total matched before history filters: {preview.totalMatchingBeforeHistory}</p>
            <p>Available after history filters: {preview.totalAvailable}</p>
            <p>Questions in this test: {preview.plannedQuestionCount}</p>
          </>
        ) : (
          <p>Preview data will appear here once you choose filters.</p>
        )}
      </div>

      <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Starting…" : "Start test"}
      </button>
    </form>
  );
}
