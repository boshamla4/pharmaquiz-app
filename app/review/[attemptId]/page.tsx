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
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Review answers</h1>
          <p className="mt-2 text-sm text-gray-600">Inspect each question, review the score, then redo everything or only the missed items.</p>
        </div>
        <Link href="/history" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          Back to history
        </Link>
      </div>
      <ReviewAttemptClient attempt={data.attempt} questions={data.questions} />
    </main>
  );
}
