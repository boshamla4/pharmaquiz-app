import Link from "next/link";
import { getDashboardData, getAvailableSections } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";
import { formatScore } from "@/lib/scoring";
import StartAttemptForm from "@/app/components/StartAttemptForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requirePageSession();
  const dashboard = await getDashboardData(session.profileId);
  const sections = getAvailableSections();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-blue-600">Welcome back</p>
          <h1 className="text-3xl font-bold">{session.displayName}</h1>
          <p className="mt-2 text-sm text-gray-600">Start a test, resume an unfinished one, or review your previous scores.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            Logout
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Completed tests</p>
          <p className="mt-2 text-3xl font-bold">{dashboard.completedCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average score</p>
          <p className="mt-2 text-3xl font-bold">{dashboard.averageScore}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Saved progress</p>
          <p className="mt-2 text-3xl font-bold">{dashboard.inProgress.length}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Start a new test</h2>
          <p className="mt-2 text-sm text-gray-600">
            Choose ordered or randomized delivery, filter by section/type, optionally enable a timer, and save progress at
            any point.
          </p>
          <div className="mt-6">
            <StartAttemptForm sections={sections} />
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Continue later</h2>
              <Link href="/history" className="text-sm font-medium text-blue-600">
                Full history
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.inProgress.length === 0 ? (
                <p className="text-sm text-gray-600">No saved tests right now.</p>
              ) : (
                dashboard.inProgress.map((attempt) => (
                  <div key={attempt.id} className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
                    <p className="font-semibold">{attempt.mode === "ordered" ? "Ordered" : "Randomized"} test</p>
                    <p className="mt-1 text-gray-600">
                      {attempt.answered_questions} / {attempt.total_questions} answered
                    </p>
                    <Link href={`/attempt/${attempt.id}`} className="mt-3 inline-flex text-blue-600">
                      Resume test →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Recent history</h2>
            <div className="mt-4 space-y-3">
              {dashboard.recentHistory.length === 0 ? (
                <p className="text-sm text-gray-600">Submit a test to see review history here.</p>
              ) : (
                dashboard.recentHistory.map((attempt) => (
                  <div key={attempt.id} className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
                    <p className="font-semibold">
                      Score {formatScore(attempt.score ?? 0)} / {attempt.total_questions}
                    </p>
                    <p className="mt-1 text-gray-600">Submitted {new Date(attempt.submitted_at ?? attempt.updated_at).toLocaleString()}</p>
                    <Link href={`/review/${attempt.id}`} className="mt-3 inline-flex text-blue-600">
                      Review answers →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
