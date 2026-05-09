import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { hasSupabaseServerEnv } from "@/lib/env";

export async function GET(_request: NextRequest) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Session invalid or missing." }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    profileId: session.profileId,
    displayName: session.displayName,
  });
}
