import { NextRequest, NextResponse } from "next/server";
import { getSessionValidation, SESSION_COOKIE_NAME } from "@/lib/auth";
import { hasSupabaseServerEnv } from "@/lib/env";

export async function GET(_request: NextRequest) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const result = await getSessionValidation();

  if (!result.session) {
    const response = NextResponse.json({ error: "Session invalid.", code: result.code }, { status: 401 });
    if (result.code !== "SESSION_MISSING") {
      response.cookies.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    }
    return response;
  }

  return NextResponse.json({
    valid: true,
    profileId: result.session.profileId,
    displayName: result.session.displayName,
  });
}
