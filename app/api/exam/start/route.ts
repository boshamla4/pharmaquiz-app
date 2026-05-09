import { NextRequest, NextResponse } from "next/server";
import { createAttempt } from "@/lib/attempts";
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
    const attemptId = await createAttempt(session.profileId, {
      sections: normalizeStringArray(body.sections ?? body.files),
      questionTypes: normalizeStringArray(body.questionTypes).filter(
        (entry): entry is "single" | "multiple" => entry === "single" || entry === "multiple",
      ),
      orderMode: body.orderMode === "random" ? "random" : "ordered",
      includeRepeated: body.includeRepeated !== false,
      wrongOnly: body.wrongOnly === true,
      useAllQuestions: Boolean(body.useAllQuestions),
      limit: Math.max(1, Math.min(200, Number(body.limit) || 20)),
      timerMinutes: typeof body.timerMinutes === "number" ? Math.max(1, Math.min(240, body.timerMinutes)) : null,
    });

    return NextResponse.json({ examId: attemptId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start exam." },
      { status: 400 },
    );
  }
}
