import QuizClient from "@/app/components/QuizClient";
import parsedQuestions from "@/scripts/generated/parsed-questions.json";
import type { ParsedQuestionsFile } from "@/lib/quiz-types";

export default function Home() {
  return <QuizClient data={parsedQuestions as ParsedQuestionsFile} />;
}
