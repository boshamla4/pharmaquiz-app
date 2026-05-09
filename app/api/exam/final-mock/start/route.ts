import { NextRequest, NextResponse } from "next/server";
import { createAttempt, getAvailableSections } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

const DEFAULT_TOTAL_QUESTIONS = 100;

function allocateByWeights(total: number, weightedSections: Array<{ name: string; count: number }>): number[] {
  const totalSourceQuestions = weightedSections.reduce((sum, section) => sum + section.count, 0);
  if (totalSourceQuestions === 0 || weightedSections.length === 0) return [];

  const raw = weightedSections.map((section) => (total * section.count) / totalSourceQuestions);
  const base = raw.map((value) => Math.floor(value));
  let assigned = base.reduce((sum, value) => sum + value, 0);

  const remainders = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder);

  let cursor = 0;
  while (assigned < total && cursor < remainders.length) {
    base[remainders[cursor].index] += 1;
    assigned += 1;
    cursor += 1;
  }

  return base;
}

export async function GET(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const totalQuestionsRaw = Number(request.nextUrl.searchParams.get("totalQuestions") ?? DEFAULT_TOTAL_QUESTIONS);
  const totalQuestions = Number.isFinite(totalQuestionsRaw) && totalQuestionsRaw > 0
    ? Math.min(200, Math.floor(totalQuestionsRaw))
    : DEFAULT_TOTAL_QUESTIONS;

  const sections = getAvailableSections();
  const targets = allocateByWeights(totalQuestions, sections);
  const totalQuestionsInBank = sections.reduce((sum, section) => sum + section.count, 0);

  return NextResponse.json({
    program: "Pharmacy",
    totalQuestions,
    totalWeightPercent: 100,
    sections: sections.map((section, index) => ({
      subject: section.name,
      weightPercent: totalQuestionsInBank > 0 ? Number(((section.count / totalQuestionsInBank) * 100).toFixed(2)) : 0,
      targetQuestions: targets[index] ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { totalQuestions?: number; timerMinutes?: number } | null;
  const totalQuestions = Math.max(1, Math.min(200, Number(body?.totalQuestions) || DEFAULT_TOTAL_QUESTIONS));
  const timerMinutes = typeof body?.timerMinutes === "number" && body.timerMinutes > 0
    ? Math.max(1, Math.min(240, Math.floor(body.timerMinutes)))
    : null;

  try {
    const attemptId = await createAttempt(session.profileId, {
      sections: [],
      questionTypes: [],
      orderMode: "random",
      includeRepeated: true,
      wrongOnly: false,
      useAllQuestions: false,
      limit: totalQuestions,
      timerMinutes,
    });
    return NextResponse.json({ examId: attemptId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start final mock." },
      { status: 400 },
    );
  }
}
