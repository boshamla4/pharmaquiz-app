import Link from "next/link";
import { getAttemptHistory } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";
import { formatScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requirePageSession();
  const attempts = await getAttemptHistory(session.profileId);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Test history</h1>
          <p className="mt-2 text-sm text-gray-600">Review completed tests or jump back into a saved draft.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          Dashboard
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {attempts.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            No tests have been created yet.
          </p>
        ) : (
          attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {attempt.status === "submitted"
                      ? `Score ${formatScore(attempt.score ?? 0)} / ${attempt.total_questions}`
                      : `Saved draft · ${attempt.answered_questions} / ${attempt.total_questions} answered`}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {attempt.mode === "ordered" ? "Ordered" : "Randomized"} · Updated {new Date(attempt.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    href={attempt.status === "submitted" ? `/review/${attempt.id}` : `/attempt/${attempt.id}`}
                    className="rounded-lg border border-gray-300 px-4 py-2"
                  >
                    {attempt.status === "submitted" ? "Review" : "Resume"}
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
