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
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <AttemptRunner
        attempt={data.attempt}
        questions={data.questions}
        initialRemainingSeconds={data.attempt.timer_seconds}
      />
    </main>
  );
}
