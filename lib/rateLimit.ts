interface MemoryRateLimitEntry {
  count: number;
  firstAttempt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const memoryStore = new Map<string, MemoryRateLimitEntry>();

export function checkAndRecordAttempt(ip: string): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const existing = memoryStore.get(ip);

  if (!existing || now - existing.firstAttempt > WINDOW_MS) {
    const fresh = { count: 1, firstAttempt: now };
    memoryStore.set(ip, fresh);
    return { allowed: true, remaining: MAX_ATTEMPTS - fresh.count };
  }

  existing.count += 1;
  memoryStore.set(ip, existing);

  if (existing.count <= MAX_ATTEMPTS) {
    return { allowed: true, remaining: MAX_ATTEMPTS - existing.count };
  }

  const retryAfterMs = Math.max(1, WINDOW_MS - (now - existing.firstAttempt));
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  };
}
