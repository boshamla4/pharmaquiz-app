import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseServerEnv } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";

export const SESSION_COOKIE_NAME = "pharmaquiz_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export interface UserSession {
  sessionId: string;
  profileId: string;
  displayName: string;
}

type SessionValidation =
  | { session: UserSession; code: "OK" }
  | { session: null; code: "SESSION_MISSING" | "SESSION_EXPIRED" | "SESSION_HIJACKED" | "SESSION_INVALID" };

async function hydrateSession(token: string): Promise<SessionValidation> {
  if (!token || !hasSupabaseServerEnv()) {
    return { session: null, code: "SESSION_MISSING" };
  }

  const db = getServiceSupabase();
  const { data: sessionRow, error } = await db
    .from("user_sessions")
    .select("id, profile_id, expires_at, revoked_at")
    .eq("session_hash", token)
    .maybeSingle();

  if (error || !sessionRow) return { session: null, code: "SESSION_INVALID" };
  if (sessionRow.revoked_at) return { session: null, code: "SESSION_EXPIRED" };
  if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
    return { session: null, code: "SESSION_EXPIRED" };
  }

  const { data: profileRow, error: profileError } = await db
    .from("profiles")
    .select("id, display_name, active_session_id")
    .eq("id", sessionRow.profile_id)
    .maybeSingle();

  if (profileError || !profileRow) return { session: null, code: "SESSION_INVALID" };

  // Single-session enforcement: if this profile has a newer session, kick this one
  if (profileRow.active_session_id && profileRow.active_session_id !== sessionRow.id) {
    return { session: null, code: "SESSION_HIJACKED" };
  }

  await db.from("user_sessions").update({ last_seen: new Date().toISOString() }).eq("id", sessionRow.id);

  return {
    session: { sessionId: sessionRow.id, profileId: profileRow.id, displayName: profileRow.display_name },
    code: "OK",
  };
}

// Stores the session token as a plain UUID string in session_hash (not bcrypt-hashed)
// so the validate route can look it up directly.

export async function getCurrentSession(): Promise<UserSession | null> {
  if (!hasSupabaseServerEnv()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const result = await hydrateSession(token);
  return result.session;
}

export async function getSessionValidation(): Promise<SessionValidation> {
  if (!hasSupabaseServerEnv()) return { session: null, code: "SESSION_MISSING" };
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!token) return { session: null, code: "SESSION_MISSING" };
  return hydrateSession(token);
}

export async function requirePageSession(): Promise<UserSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireApiSession(request: NextRequest): Promise<UserSession | NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const result = await hydrateSession(token);
  if (!result.session) {
    return NextResponse.json({ error: "Authentication required", code: result.code }, { status: 401 });
  }
  return result.session;
}

export async function authenticateAccessToken(token: string): Promise<{ id: string; display_name: string } | null> {
  const db = getServiceSupabase();
  // Token is stored plaintext — no hashing
  const { data: tokenRow, error } = await db
    .from("access_tokens")
    .select("profile_id")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !tokenRow) return null;

  const { data: profileRow, error: profileError } = await db
    .from("profiles")
    .select("id, display_name")
    .eq("id", tokenRow.profile_id)
    .maybeSingle();

  if (profileError || !profileRow) return null;
  return profileRow;
}

export async function createSession(profileId: string, request: NextRequest): Promise<string> {
  const db = getServiceSupabase();
  const sessionId = randomUUID();
  // Plain UUID token stored in session_hash — no cryptographic hash needed
  // because the cookie itself is httpOnly and the DB lookup is direct equality
  const sessionToken = `${randomUUID()}-${randomBytes(18).toString("hex")}`;

  // Revoke all previous sessions for this profile
  await db
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("revoked_at", null);

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const { error } = await db.from("user_sessions").insert({
    id: sessionId,
    profile_id: profileId,
    session_hash: sessionToken,
    user_agent: request.headers.get("user-agent") ?? "",
    ip_address:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown",
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create session: ${error.message}`);

  // Update the profile's active_session_id so other devices get SESSION_HIJACKED
  await db.from("profiles").update({ active_session_id: sessionId }).eq("id", profileId);

  return sessionToken;
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token || !hasSupabaseServerEnv()) return;
  const db = getServiceSupabase();
  const { data: sessionRow } = await db
    .from("user_sessions")
    .select("id, profile_id")
    .eq("session_hash", token)
    .maybeSingle();

  if (!sessionRow) return;
  await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionRow.id);
  // Clear active_session_id only if it still points to this session
  await db
    .from("profiles")
    .update({ active_session_id: null })
    .eq("id", sessionRow.profile_id)
    .eq("active_session_id", sessionRow.id);
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}
