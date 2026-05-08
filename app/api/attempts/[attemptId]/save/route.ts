import { NextRequest, NextResponse } from "next/server";
import { saveAttemptProgress } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const { attemptId } = await params;
  const body = (await request.json().catch(() => null)) as {
    currentIndex?: number;
    answers?: Array<{ attemptQuestionId?: string; selectedAnswerIds?: unknown }>;
  } | null;

  if (!body || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await saveAttemptProgress(
      session.profileId,
      attemptId,
      Math.max(0, Number(body.currentIndex) || 0),
      body.answers
        .filter((entry): entry is { attemptQuestionId: string; selectedAnswerIds?: unknown } => typeof entry.attemptQuestionId === "string")
        .map((entry) => ({
          attemptQuestionId: entry.attemptQuestionId,
          selectedAnswerIds: Array.isArray(entry.selectedAnswerIds)
            ? entry.selectedAnswerIds.filter((value): value is string => typeof value === "string")
            : [],
        })),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save progress." },
      { status: 400 },
    );
  }
}
