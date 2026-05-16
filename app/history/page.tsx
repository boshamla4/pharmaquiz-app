import Link from "next/link";
import { getAttemptHistory } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";
import { formatScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requirePageSession();
  const attempts = await getAttemptHistory(session.profileId);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">Records</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Test history</h1>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {attempts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No tests yet. Start one from the dashboard.</p>
          </div>
        ) : (
          attempts.map((attempt) => {
            const submitted = attempt.status === "submitted";
            const date = new Date(attempt.updated_at);
            return (
              <div
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4"
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      submitted
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {submitted ? "Done" : "Draft"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {submitted
                        ? `${formatScore(attempt.score ?? 0)} / ${attempt.total_questions}`
                        : `${attempt.answered_questions} / ${attempt.total_questions} answered`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {attempt.mode === "ordered" ? "Ordered" : "Random"} ·{" "}
                      {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <Link
                  href={submitted ? `/review/${attempt.id}` : `/attempt/${attempt.id}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {submitted ? "Review" : "Resume"} →
                </Link>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
