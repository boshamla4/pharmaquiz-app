import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewAttemptClient from "@/app/components/ReviewAttemptClient";
import { getAttempt } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const session = await requirePageSession();
  const data = await getAttempt(session.profileId, attemptId);

  if (!data || data.attempt.status !== "submitted") {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">Review</p>
        <Link
          href="/history"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← History
        </Link>
      </div>
      <ReviewAttemptClient attempt={data.attempt} questions={data.questions} />
    </main>
  );
}
