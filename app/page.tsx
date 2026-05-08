import { redirect } from "next/navigation";
import QuizClient from "@/app/components/QuizClient";
import { getCurrentSession } from "@/lib/auth";
import { hasSupabaseServerEnv } from "@/lib/env";
import type { ParsedQuestionsFile } from "@/lib/quiz-types";
import parsedQuestions from "@/scripts/generated/parsed-questions.json";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasSupabaseServerEnv()) {
    return <QuizClient data={parsedQuestions as ParsedQuestionsFile} />;
  }

  const session = await getCurrentSession();
  redirect(session ? "/dashboard" : "/login");
}
