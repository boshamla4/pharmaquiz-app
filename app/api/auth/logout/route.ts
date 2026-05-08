import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, revokeSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await revokeSession(sessionToken);

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookie(response);
  return response;
}
