import { NextRequest, NextResponse } from "next/server";
import { getAttemptPreview } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean) : [];
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const preview = await getAttemptPreview(session.profileId, {
      sections: normalizeStringArray(body.sections ?? body.files),
      questionTypes: normalizeStringArray(body.questionTypes).filter(
        (entry): entry is "single" | "multiple" => entry === "single" || entry === "multiple",
      ),
      includeRepeated: body.includeRepeated !== false,
      wrongOnly: body.wrongOnly === true,
      useAllQuestions: Boolean(body.useAllQuestions),
      limit: Math.max(1, Math.min(1000, Number(body.limit) || 25)),
    });

    return NextResponse.json({
      totalMatchingBeforeHistory: preview.totalMatchingBeforeHistory,
      totalAvailable: preview.totalAvailable,
      plannedQuestionCount: preview.plannedQuestionCount,
      sectionRows: preview.sectionRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute preview." },
      { status: 500 },
    );
  }
}
