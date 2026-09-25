import { isDemoMode } from "@/lib/claude";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ demo: isDemoMode() });
}
