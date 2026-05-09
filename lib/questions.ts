import parsedQuestions from "@/scripts/generated/parsed-questions.json";
import type { ParsedQuestion, ParsedQuestionsFile, QuestionSnapshot } from "@/lib/quiz-types";

const questionsFile = parsedQuestions as ParsedQuestionsFile;

function normalizeQuestion(section: string, question: ParsedQuestion, sourceOrder: number): QuestionSnapshot {
  return {
    ...question,
    images: question.images ?? [],
    options: question.options.map((option) => ({
      ...option,
      images: option.images ?? [],
    })),
    correct_answers: [...question.correct_answers],
    type: question.type ?? (question.correct_answers.length > 1 ? "multiple" : "single"),
    section,
    source_order: sourceOrder,
  };
}

const questionBank = questionsFile.files.flatMap((section, sectionIndex) =>
  section.questions.map((question, questionIndex) =>
    normalizeQuestion(section.file, question, sectionIndex * 100000 + questionIndex),
  ),
);

export function getQuestionBank(): QuestionSnapshot[] {
  return questionBank.map((question) => ({
    ...question,
    images: [...(question.images ?? [])],
    options: question.options.map((option) => ({ ...option, images: [...(option.images ?? [])] })),
    correct_answers: [...question.correct_answers],
  }));
}

export function getSections(): Array<{ name: string; count: number }> {
  return questionsFile.files.map((section) => ({ name: section.file, count: section.questions.length }));
}

export function filterQuestionBank(options: {
  sections?: string[];
  questionTypes?: Array<"single" | "multiple">;
}): QuestionSnapshot[] {
  const sectionFilter = new Set((options.sections ?? []).filter(Boolean));
  const typeFilter = new Set((options.questionTypes ?? []).filter(Boolean));

  return getQuestionBank().filter((question) => {
    if (sectionFilter.size > 0 && !sectionFilter.has(question.section)) return false;
    if (typeFilter.size > 0 && !typeFilter.has(question.type ?? "single")) return false;
    return true;
  });
}

export function sortQuestions(
  questions: QuestionSnapshot[],
  mode: "ordered" | "random",
): QuestionSnapshot[] {
  const cloned = questions.map((question) => ({
    ...question,
    images: [...(question.images ?? [])],
    options: question.options.map((option) => ({ ...option, images: [...(option.images ?? [])] })),
    correct_answers: [...question.correct_answers],
  }));

  if (mode === "ordered") {
    return cloned.sort((left, right) => {
      if (left.section !== right.section) return left.section.localeCompare(right.section);
      if ((left.question_number ?? 0) !== (right.question_number ?? 0)) {
        return (left.question_number ?? 0) - (right.question_number ?? 0);
      }
      return left.source_order - right.source_order;
    });
  }

  // Fisher-Yates shuffle
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}
