import Link from "next/link";
import FinalMockStarter from "@/app/components/FinalMockStarter";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FinalMockPage() {
  await requirePageSession();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400">Exam mode</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Final mock exam</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Randomized full-length test weighted by section distribution.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <FinalMockStarter />
      </div>
    </main>
  );
}
