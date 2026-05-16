import QuestionMedia from "@/app/components/QuestionMedia";
import { scoreFeedback } from "@/lib/scoring";
import type { QuestionSnapshot } from "@/lib/quiz-types";

interface QuestionCardProps {
  question: QuestionSnapshot;
  selectedIds: string[];
  disabled?: boolean;
  showResults?: boolean;
  scoreWeight?: number | null;
  onToggle?: (optionId: string, checked: boolean) => void;
}

export default function QuestionCard({
  question,
  selectedIds,
  disabled = false,
  showResults = false,
  scoreWeight = null,
  onToggle,
}: QuestionCardProps) {
  const isMultiple = (question.type ?? "single") === "multiple";

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      {/* Meta row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          {question.section}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Q{question.question_number}{question.source_page ? ` · p.${question.source_page}` : ""}
        </span>
      </div>

      {isMultiple && (
        <span className="mb-3 inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Select all that apply
        </span>
      )}

      <p className="text-base font-medium leading-relaxed text-gray-900 dark:text-gray-100">
        {question.question_text}
      </p>
      <QuestionMedia images={question.images} alt="Question visual" />

      <div className="mt-5 space-y-2">
        {question.options.map((option) => {
          const checked = selectedIds.includes(option.id);
          const correct = question.correct_answers.includes(option.id);
          const wrongPick = showResults && checked && !correct;
          const missed = showResults && !checked && correct;
          const rightPick = showResults && checked && correct;

          let rowClass =
            "border-gray-200 dark:border-gray-700 " +
            (!disabled ? "cursor-pointer hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/40 dark:hover:bg-teal-900/10" : "cursor-default");
          let badgeClass = "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";

          if (checked && !showResults) {
            rowClass = "border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20 cursor-pointer";
            badgeClass = "bg-teal-600 text-white";
          }
          if (rightPick) {
            rowClass = "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 cursor-default";
            badgeClass = "bg-emerald-500 text-white";
          }
          if (wrongPick) {
            rowClass = "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 cursor-default";
            badgeClass = "bg-red-500 text-white";
          }
          if (missed) {
            rowClass = "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 cursor-default";
            badgeClass = "bg-amber-400 text-white";
          }

          return (
            <label
              key={option.id}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 transition-colors ${rowClass}`}
            >
              <input
                type={isMultiple ? "checkbox" : "radio"}
                name={`question-${question.id}`}
                checked={checked}
                onChange={(event) => onToggle?.(option.id, event.target.checked)}
                disabled={disabled}
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${badgeClass}`}
              >
                {option.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{option.text}</p>
                <QuestionMedia images={option.images} alt={`Option ${option.id} visual`} />
              </div>
            </label>
          );
        })}
      </div>

      {showResults && scoreWeight !== null ? (
        <p className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          {scoreFeedback(scoreWeight)}
        </p>
      ) : null}
    </div>
  );
}
