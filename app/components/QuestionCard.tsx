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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-gray-500">
        <span>{question.section}</span>
        <span>
          Question {question.question_number}
          {question.source_page ? ` · Page ${question.source_page}` : ""}
        </span>
      </div>

      <p className="mt-3 text-base font-medium leading-relaxed">{question.question_text}</p>
      <QuestionMedia images={question.images} alt="Question visual" />

      <div className="mt-5 space-y-3">
        {question.options.map((option) => {
          const checked = selectedIds.includes(option.id);
          const correct = question.correct_answers.includes(option.id);
          const wrongPick = showResults && checked && !correct;
          const missed = showResults && !checked && correct;
          const rightPick = showResults && checked && correct;

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
                  name={`question-${question.id}`}
                  checked={checked}
                  onChange={(event) => onToggle?.(option.id, event.target.checked)}
                  disabled={disabled}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    <span className="mr-1 font-semibold">{option.id}.</span>
                    {option.text}
                  </p>
                  <QuestionMedia images={option.images} alt={`Option ${option.id} visual`} />
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {showResults && scoreWeight !== null ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{scoreFeedback(scoreWeight)}</p>
      ) : null}
    </div>
  );
}
