import "server-only";
import { kvIncr } from "./kv";

// Caps how often one visitor can call the AI features, so a public site can't run up the API bill.
// Limits are per IP address per hour and can be tuned with env vars (e.g. RATE_LIMIT_COVER_LETTER=40).

const LIMITS = {
  "cover-letter": 20,
  "analyze-job": 40,
  interview: 150,
  feedback: 15,
  "feed-submit": 20,
} as const;

export type LimitedAction = keyof typeof LIMITS;

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 response when the visitor is over the limit, otherwise null. */
export async function rateLimit(req: Request, action: LimitedAction): Promise<Response | null> {
  const limit = Number.parseInt(process.env[`RATE_LIMIT_${action.toUpperCase().replace(/-/g, "_")}`] ?? "", 10) || LIMITS[action];
  const hour = Math.floor(Date.now() / 3_600_000);
  try {
    const count = await kvIncr(`ratelimit:${action}:${clientIp(req)}:${hour}`, 3600);
    if (count > limit) {
      return Response.json(
        { error: "You've reached the hourly limit for this feature. Please try again in a little while." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
  } catch {
    // If the counter store is unavailable, don't block people.
  }
  return null;
}
