// Best-effort, in-memory sliding-window rate limiter. Honest caveat:
// Vercel serverless functions don't guarantee the same instance (and
// therefore the same in-memory Map) handles consecutive requests, so
// this is a real but leaky defense — it meaningfully slows down casual
// abuse hitting a warm instance, not a hard guarantee against a
// determined attacker spreading requests across cold starts. A durable
// store (Vercel KV, Upstash Redis) would close that gap; not added here
// since it needs an account/credential this environment doesn't have.
// Still strictly better than the zero rate limiting these endpoints had.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Opportunistic cleanup so this doesn't grow unbounded on a long-lived
// instance — runs every ~500 calls rather than on every one.
let callCount = 0;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  callCount++;
  if (callCount % 500 === 0) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true };
}

/** Best guess at the caller's IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
