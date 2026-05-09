import { NextRequest, NextResponse } from "next/server";
import { saveAttemptProgress, submitAttempt } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";
import { formatServerTiming, recordApiMetric } from "@/lib/performanceMetrics";

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const requestStart = Date.now();
  const stages: Record<string, number> = {};

  const body = (await request.json().catch(() => null)) as {
    examId?: string;
    answers?: Array<{ examQuestionId?: string; selectedAnswerIds?: unknown }>;
  } | null;

  if (!body?.examId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const saveStart = Date.now();
    await saveAttemptProgress(
      session.profileId,
      body.examId,
      0,
      body.answers
        .filter((entry): entry is { examQuestionId: string; selectedAnswerIds?: unknown } => typeof entry.examQuestionId === "string")
        .map((entry) => ({
          attemptQuestionId: entry.examQuestionId,
          selectedAnswerIds: Array.isArray(entry.selectedAnswerIds)
            ? entry.selectedAnswerIds.filter((value): value is string => typeof value === "string")
            : [],
        })),
    );
    stages.save_answers = Date.now() - saveStart;

    const submitStart = Date.now();
    const result = await submitAttempt(session.profileId, body.examId);
    stages.submit_attempt = Date.now() - submitStart;

    const totalMs = Date.now() - requestStart;
    const response = NextResponse.json(result);
    response.headers.set("Server-Timing", formatServerTiming(stages, totalMs));
    await recordApiMetric({
      route: "/api/exam/submit",
      statusCode: 200,
      profileId: session.profileId,
      totalMs,
      itemCount: body.answers.length,
      stages,
      meta: { examId: body.examId },
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit exam." },
      { status: 400 },
    );
  }
}
