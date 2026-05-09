import type { QuestionSnapshot } from "@/lib/quiz-types";

export function scoreQuestion(question: QuestionSnapshot, selectedIds: string[]): number {
  const answers = question.options;
  if (answers.length === 0 || selectedIds.length === 0) return 0;

  const selected = new Set(selectedIds);
  const correct = new Set(question.correct_answers);

  if ((question.type ?? "single") !== "multiple") {
    return correct.size === 1 && selected.size === 1 && selected.has(question.correct_answers[0]) ? 1 : 0;
  }

  const answerCount = answers.length;
  let raw = 0;

  for (const answer of answers) {
    const chosen = selected.has(answer.id);
    const isCorrect = correct.has(answer.id);
    if (isCorrect) {
      raw += chosen ? 1 / answerCount : -1 / answerCount;
    } else {
      raw += chosen ? -1 / answerCount : 1 / answerCount;
    }
  }

  return Math.max(0, Math.min(1, raw));
}

export function isFullyCorrect(question: QuestionSnapshot, selectedIds: string[]): boolean {
  return scoreQuestion(question, selectedIds) === 1;
}

export function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

export function scoreFeedback(score: number): string {
  if (score === 1) return "Correct answer.";
  if (score === 0) return "Incorrect answer. Review the highlighted options.";
  return `Partial credit: ${formatScore(score)} point.`;
}
