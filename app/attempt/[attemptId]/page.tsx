import { notFound, redirect } from "next/navigation";
import AttemptRunner from "@/app/components/AttemptRunner";
import { getAttempt } from "@/lib/attempts";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const session = await requirePageSession();
  const data = await getAttempt(session.profileId, attemptId);

  if (!data) {
    notFound();
  }

  if (data.attempt.status === "submitted") {
    redirect(`/review/${attemptId}`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Active test</h1>
          <p className="mt-2 text-sm text-gray-600">Save progress, return later, or submit when you are ready.</p>
        </div>
      </div>
      <AttemptRunner
        attempt={data.attempt}
        questions={data.questions}
        initialRemainingSeconds={data.attempt.timer_seconds}
      />
    </main>
  );
}
