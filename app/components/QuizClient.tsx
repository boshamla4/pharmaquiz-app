"use client";

import { useMemo, useState } from "react";
import type { ParsedQuestionsFile, ParsedQuestion } from "@/lib/quiz-types";

function QuestionMedia({ images }: { images?: string[] }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="mt-3 grid gap-3">
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt="Question visual"
          className="max-h-72 w-auto rounded-lg border border-gray-200"
          loading="lazy"
        />
      ))}
    </div>
  );
}

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

  const question = section?.questions[index] as ParsedQuestion | undefined;

  if (!section || !question) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">PharmaQuiz</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No parsed questions were found. Run <code>npm run parse:data</code> after placing your PDF at
          <code> scripts/input/source.pdf</code>.
        </p>
      </main>
    );
  }

  const activeQuestion = question;
  const currentSelections = answers[activeQuestion.id] ?? [];
  const isMultiple =
    (activeQuestion.type ?? (activeQuestion.correct_answers.length > 1 ? "multiple" : "single")) === "multiple";
  const isRevealed = Boolean(revealed[activeQuestion.id]);

  function selectOption(optionId: string, checked: boolean) {
    setAnswers((prev) => {
      if (!isMultiple) {
        return { ...prev, [activeQuestion.id]: [optionId] };
      }

      const next = new Set(prev[activeQuestion.id] ?? []);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return { ...prev, [activeQuestion.id]: Array.from(next) };
    });
  }

  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">PharmaQuiz</h1>
      <p className="mt-2 text-sm text-gray-600">Static quiz mode with section-based question banks.</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <label htmlFor="section" className="mb-2 block text-sm font-semibold text-gray-700">
          Section
        </label>
        <select
          id="section"
          value={section.file}
          onChange={(e) => {
            setSectionName(e.target.value);
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

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
          <span>
            Question {index + 1} / {section.questions.length}
          </span>
          <span>{answeredCount} answered</span>
        </div>

        <p className="text-base font-medium leading-relaxed">{activeQuestion.question_text}</p>
        <QuestionMedia images={activeQuestion.images} />

        <div className="mt-5 space-y-3">
          {activeQuestion.options.map((option) => {
            const checked = currentSelections.includes(option.id);
            const correct = activeQuestion.correct_answers.includes(option.id);
            const wrongPick = isRevealed && checked && !correct;
            const missed = isRevealed && !checked && correct;
            const rightPick = isRevealed && checked && correct;

            let classes = "border-gray-200";
            if (rightPick) classes = "border-green-300 bg-green-50";
            else if (wrongPick) classes = "border-red-300 bg-red-50";
            else if (missed) classes = "border-amber-300 bg-amber-50";
            else if (checked) classes = "border-blue-300 bg-blue-50";

            return (
              <label key={option.id} className={`block rounded-lg border p-3 ${classes}`}>
                <div className="flex items-start gap-3">
                  <input
                    type={isMultiple ? "checkbox" : "radio"}
                    name={`q-${activeQuestion.id}`}
                    checked={checked}
                    onChange={(e) => selectOption(option.id, e.target.checked)}
                    disabled={isRevealed}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm leading-relaxed">
                      <span className="mr-1 font-semibold">{option.id}.</span>
                      {option.text}
                    </p>
                    <QuestionMedia images={option.images} />
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
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
            onClick={() => setIndex((i) => Math.min(section.questions.length - 1, i + 1))}
            disabled={index === section.questions.length - 1}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </main>
  );
}
