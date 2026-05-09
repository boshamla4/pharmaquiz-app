"use client";

import { useMemo, useState } from "react";
import QuestionCard from "@/app/components/QuestionCard";
import { isFullyCorrect } from "@/lib/scoring";
import type { ParsedQuestionsFile, QuestionSnapshot } from "@/lib/quiz-types";

export default function QuizClient({ data }: { data: ParsedQuestionsFile }) {
  const sections = data.files;
  const [sectionName, setSectionName] = useState(sections[0]?.file ?? "");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const section = useMemo(
    () => sections.find((item) => item.file === sectionName) ?? sections[0],
    [sections, sectionName],
  );

  const question = section?.questions[index];

  if (!section || !question) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">PharmaQuiz</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No parsed questions were found. Run <code>npm run parse:data</code> after placing your PDF at
          <code> scripts/input/source.pdf</code>.
        </p>
      </main>
    );
  }

  const activeQuestion = {
    ...question,
    section: section.file,
    source_order: index,
  } satisfies QuestionSnapshot;
  const currentSelections = answers[activeQuestion.id] ?? [];
  const isRevealed = Boolean(revealed[activeQuestion.id]);

  function toggleOption(optionId: string, checked: boolean) {
    setAnswers((prev) => {
      if ((activeQuestion.type ?? "single") !== "multiple") {
        return { ...prev, [activeQuestion.id]: checked ? [optionId] : [] };
      }

      const next = new Set(prev[activeQuestion.id] ?? []);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return { ...prev, [activeQuestion.id]: Array.from(next) };
    });
  }

  const answeredCount = Object.values(answers).filter((value) => value.length > 0).length;
  const previewScore = isFullyCorrect(activeQuestion, currentSelections) ? 1 : 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Supabase is not configured yet, so you are seeing the local preview mode. Configure the environment variables in
        the README to unlock authentication, saved attempts, review history, and Vercel-ready hosting.
      </div>

      <h1 className="mt-6 text-3xl font-bold">PharmaQuiz</h1>
      <p className="mt-2 text-sm text-gray-600">Responsive preview mode using the generated question bank from your PDF.</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <label htmlFor="section" className="mb-2 block text-sm font-semibold text-gray-700">
          Section
        </label>
        <select
          id="section"
          value={section.file}
          onChange={(event) => {
            setSectionName(event.target.value);
            setIndex(0);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {sections.map((item) => (
            <option key={item.file} value={item.file}>
              {item.file} ({item.questions.length} questions)
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          Question {index + 1} / {section.questions.length}
        </span>
        <span>{answeredCount} answered</span>
      </div>

      <div className="mt-4">
        <QuestionCard
          question={activeQuestion}
          selectedIds={currentSelections}
          disabled={isRevealed}
          showResults={isRevealed}
          scoreWeight={isRevealed ? previewScore : null}
          onToggle={toggleOption}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          ← Previous
        </button>

        <button
          onClick={() => setRevealed((prev) => ({ ...prev, [activeQuestion.id]: true }))}
          disabled={isRevealed || currentSelections.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Check answer
        </button>

        <button
          onClick={() => setIndex((value) => Math.min(section.questions.length - 1, value + 1))}
          disabled={index === section.questions.length - 1}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </main>
  );
}
