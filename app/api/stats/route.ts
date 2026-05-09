import { NextRequest, NextResponse } from "next/server";
import { getAttemptSectionStats, type StatsMode } from "@/lib/analytics";
import { requireApiSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const mode: StatsMode = request.nextUrl.searchParams.get("mode") === "all" ? "all" : "last";

  try {
    const result = await getAttemptSectionStats(session.profileId, mode);
    return NextResponse.json({
      mode: result.mode,
      stats: result.stats,
      exam_count: result.examCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load stats." },
      { status: 500 },
    );
  }
}
