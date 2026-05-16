import Link from "next/link";
import { getDashboardData, getAvailableSections } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";
import { formatScore } from "@/lib/scoring";
import ActiveUsersBadge from "@/app/components/ActiveUsersBadge";
import StartAttemptForm from "@/app/components/StartAttemptForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requirePageSession();
  const dashboard = await getDashboardData(session.profileId);
  const sections = getAvailableSections();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{session.displayName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActiveUsersBadge />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{dashboard.completedCount}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">tests submitted</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Average score</p>
          <p className="mt-2 text-3xl font-bold text-teal-600 dark:text-teal-400">{dashboard.averageScore}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">across all submissions</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">In progress</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{dashboard.inProgress.length}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">saved drafts</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr,1fr]">
        {/* Start new test */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New test</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Filter by section and type, choose ordered or random delivery, and optionally set a timer.
          </p>
          <div className="mt-5">
            <StartAttemptForm sections={sections} />
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Quick actions</h2>
            <div className="space-y-2">
              <Link
                href="/final-mock"
                className="flex items-center justify-between rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                <span>Final mock exam</span>
                <span>→</span>
              </Link>
              <Link
                href="/stats"
                className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span>Performance stats</span>
                <span>→</span>
              </Link>
              <Link
                href="/history"
                className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span>Full history</span>
                <span>→</span>
              </Link>
            </div>
          </section>

          {/* In progress */}
          {dashboard.inProgress.length > 0 && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Continue later</h2>
              <div className="space-y-2">
                {dashboard.inProgress.map((attempt) => (
                  <div key={attempt.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {attempt.mode === "ordered" ? "Ordered" : "Random"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {attempt.answered_questions} / {attempt.total_questions} answered
                        </p>
                      </div>
                      <Link
                        href={`/attempt/${attempt.id}`}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
                      >
                        Resume
                      </Link>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-1 rounded-full bg-teal-500"
                        style={{ width: `${(attempt.answered_questions / attempt.total_questions) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent history */}
          {dashboard.recentHistory.length > 0 && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent results</h2>
                <Link href="/history" className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline">
                  All →
                </Link>
              </div>
              <div className="space-y-2">
                {dashboard.recentHistory.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatScore(attempt.score ?? 0)} / {attempt.total_questions}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(attempt.submitted_at ?? attempt.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/review/${attempt.id}`}
                      className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Review →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
