import { NextRequest, NextResponse } from "next/server";
import { submitAttempt } from "@/lib/attempts";
import { requireApiSession } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const { attemptId } = await params;

  try {
    const result = await submitAttempt(session.profileId, attemptId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit attempt." },
      { status: 400 },
    );
  }
}
