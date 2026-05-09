import Link from "next/link";
import { getAttemptSectionStats, type StatsMode } from "@/lib/analytics";
import { requirePageSession } from "@/lib/auth";

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
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
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Performance stats</h1>
          <p className="mt-2 text-sm text-gray-600">
            {mode === "last"
              ? "Showing your most recent submitted test."
              : `Aggregated across ${result.examCount} submitted tests using the latest attempt per question.`}
          </p>
        </div>
        <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          Dashboard
        </Link>
      </div>

      <div className="mt-5 inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
        <Link href="/stats?mode=last" className={`px-4 py-2 ${mode === "last" ? "bg-blue-600 text-white" : "bg-white"}`}>
          Last test
        </Link>
        <Link href="/stats?mode=all" className={`border-l border-gray-300 px-4 py-2 ${mode === "all" ? "bg-blue-600 text-white" : "bg-white"}`}>
          All tests
        </Link>
      </div>

      {result.stats.length === 0 ? (
        <p className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          No submitted tests found yet. Complete a test to unlock stats.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-right">Answered</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Consistency</th>
                  <th className="px-4 py-3 text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.stats.map((row) => (
                  <tr key={row.section} className={row.answered_count === 0 ? "opacity-60" : ""}>
                    <td className="px-4 py-3 font-medium">
                      {row.section}
                      {row.low_confidence ? (
                        <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] text-yellow-800">
                          low data
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.answered_count}/{row.total_questions}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.correct_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.answered_count === 0 ? "—" : row.partial_sum.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.answered_count === 0 ? "—" : percent(row.consistency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.answered_count === 0 ? "—" : percent(row.coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
