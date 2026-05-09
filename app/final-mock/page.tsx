import Link from "next/link";
import FinalMockStarter from "@/app/components/FinalMockStarter";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FinalMockPage() {
  await requirePageSession();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Final mock</p>
          <h1 className="mt-1 text-3xl font-bold">Weighted full-length mock exam</h1>
          <p className="mt-2 text-sm text-gray-600">
            Launch a randomized high-volume test. The blueprint is weighted by available section distribution.
          </p>
        </div>
        <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          Dashboard
        </Link>
      </div>

      <div className="mt-6">
        <FinalMockStarter />
      </div>
    </main>
  );
}
