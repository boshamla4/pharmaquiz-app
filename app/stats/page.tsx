import Link from "next/link";
import { getAttemptSectionStats, type StatsMode } from "@/lib/analytics";
import { requirePageSession } from "@/lib/auth";

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function scoreColor(ratio: number): string {
  if (ratio >= 0.7) return "bg-emerald-500";
  if (ratio >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePageSession();
  const query = await searchParams;
  const mode: StatsMode = query.mode === "all" ? "all" : "last";
  const result = await getAttemptSectionStats(session.profileId, mode);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">Analytics</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Performance</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === "last"
              ? "Based on your most recent submitted test."
              : `Aggregated across ${result.examCount} tests — latest attempt per question.`}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Mode toggle */}
      <div className="mt-5 inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
        <Link
          href="/stats?mode=last"
          className={`px-4 py-2 transition-colors ${
            mode === "last"
              ? "bg-teal-600 text-white"
              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          Last test
        </Link>
        <Link
          href="/stats?mode=all"
          className={`border-l border-gray-200 dark:border-gray-700 px-4 py-2 transition-colors ${
            mode === "all"
              ? "bg-teal-600 text-white"
              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          All tests
        </Link>
      </div>

      {result.stats.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No submitted tests yet. Complete a test to see your stats.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {result.stats.map((row) => {
            const scoreRatio = row.answered_count > 0 ? row.partial_sum / row.answered_count : 0;
            return (
              <div
                key={row.section}
                className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 ${row.answered_count === 0 ? "opacity-50" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.section}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {row.answered_count} / {row.total_questions} answered
                      {row.low_confidence ? " · low data" : ""}
                    </p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Correct</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.answered_count === 0 ? "—" : row.correct_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Score</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.answered_count === 0 ? "—" : row.partial_sum.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Coverage</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {row.answered_count === 0 ? "—" : pct(row.coverage)}
                      </p>
                    </div>
                  </div>
                </div>
                {row.answered_count > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>Accuracy</span>
                      <span>{pct(row.consistency)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-2 rounded-full transition-all ${scoreColor(scoreRatio)}`}
                        style={{ width: pct(row.consistency) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
