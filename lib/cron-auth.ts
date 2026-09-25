/** Scheduled endpoints need CRON_SECRET as a Bearer token (Vercel Cron sends it). Open in local dev. */
export function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
}
