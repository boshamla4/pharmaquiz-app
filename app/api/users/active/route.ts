import { NextRequest, NextResponse } from "next/server";
import { getActiveUsers } from "@/lib/analytics";
import { requireApiSession } from "@/lib/auth";

const DEFAULT_ACTIVE_WINDOW_MINUTES = 5;

export async function GET(request: NextRequest) {
  const session = await requireApiSession(request);
  if (session instanceof NextResponse) return session;

  const envWindow = Number(process.env.ACTIVE_USERS_WINDOW_MINUTES ?? DEFAULT_ACTIVE_WINDOW_MINUTES);
  const windowMinutes = Number.isFinite(envWindow) && envWindow > 0 ? Math.floor(envWindow) : DEFAULT_ACTIVE_WINDOW_MINUTES;

  try {
    const snapshot = await getActiveUsers(windowMinutes);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load active users." },
      { status: 500 },
    );
  }
}
