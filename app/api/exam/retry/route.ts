import { NextRequest, NextResponse } from "next/server";
import { createAttempt } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { examId?: string; filter?: string } | null;
  const examId = body?.examId;
  const filter = body?.filter === "wrong_only" ? "wrong_only" : "all";

  if (!examId) {
    return NextResponse.json({ error: "Exam ID is required." }, { status: 400 });
  }

  try {
    const attemptId = await createAttempt(session.profileId, {
      sections: [],
      questionTypes: [],
      orderMode: "ordered",
      includeRepeated: true,
      wrongOnly: false,
      useAllQuestions: true,
      limit: 1,
      timerMinutes: null,
      sourceAttemptId: examId,
      redoMode: filter,
    });
    return NextResponse.json({ examId: attemptId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry exam." },
      { status: 400 },
    );
  }
}
