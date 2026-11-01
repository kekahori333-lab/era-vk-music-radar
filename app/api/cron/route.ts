import { cronAllowed } from "@/lib/auth";
import { daily } from "@/lib/daily";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!cronAllowed(request))
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  try {
    return Response.json(await daily(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Сбой сбора" },
      { status: 503 },
    );
  }
}

// Vercel Cron sends an authenticated GET with the CRON_SECRET bearer.
export const GET = POST;
