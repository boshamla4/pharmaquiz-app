import { NextRequest, NextResponse } from "next/server";
import { applySessionCookie, authenticateAccessToken, createSession } from "@/lib/auth";
import { hasSupabaseServerEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();

  if (!token) {
    return NextResponse.json({ error: "A token is required." }, { status: 400 });
  }

  const profile = await authenticateAccessToken(token);
  if (!profile) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const sessionToken = await createSession(profile.id, request);
  const response = NextResponse.json({ success: true, profileId: profile.id });
  applySessionCookie(response, sessionToken);
  return response;
}
