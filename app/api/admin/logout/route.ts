import { cookies } from "next/headers";
import { COOKIE, sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  (await cookies()).delete(COOKIE);
  return Response.json({ ok: true });
}
