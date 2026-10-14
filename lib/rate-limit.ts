type RateLimitBucket = { count: number; expiresAt: number };

const buckets = new Map<string, RateLimitBucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function isRateLimited(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
