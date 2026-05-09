import { NextRequest, NextResponse } from "next/server";
import { createFeedback } from "@/lib/analytics";
import { requireApiSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const body = (await request.json().catch(() => null)) as { comment?: string; whatsapp?: string } | null;
  const comment = body?.comment?.trim() ?? "";
  const whatsapp = body?.whatsapp?.trim() ?? "";

  if (comment.length < 5 || comment.length > 2000) {
    return NextResponse.json(
      { error: "Comment must be between 5 and 2000 characters." },
      { status: 400 },
    );
  }

  if (whatsapp && !/^[+0-9\s()-]{3,32}$/.test(whatsapp)) {
    return NextResponse.json(
      { error: "WhatsApp format is invalid." },
      { status: 400 },
    );
  }

  try {
    await createFeedback(session.profileId, comment, whatsapp || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit feedback." },
      { status: 500 },
    );
  }
}
