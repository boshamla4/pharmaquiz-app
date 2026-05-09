import { NextRequest, NextResponse } from "next/server";
import { getAttemptHistory } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10) || 10);
  const sort = request.nextUrl.searchParams.get("sort") === "score" ? "score" : "date";

  try {
    const attempts = await getAttemptHistory(session.profileId);
    const sorted = [...attempts].sort((left, right) => {
      if (sort === "score") {
        const leftScore = left.score ?? 0;
        const rightScore = right.score ?? 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

    const total = sorted.length;
    const slice = sorted.slice((page - 1) * limit, page * limit);

    const data = slice.map((attempt) => {
      const startedAt = new Date(attempt.started_at);
      const finishedAt = attempt.submitted_at ? new Date(attempt.submitted_at) : null;
      const duration = finishedAt ? Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000) : null;

      return {
        id: attempt.id,
        started_at: attempt.started_at,
        finished_at: attempt.submitted_at,
        duration,
        score: attempt.score ?? 0,
        total: attempt.total_questions,
      };
    });

    return NextResponse.json({ data, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load exam history." },
      { status: 500 },
    );
  }
}
