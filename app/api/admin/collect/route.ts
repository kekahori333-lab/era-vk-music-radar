import { isAdmin, sameOrigin } from "@/lib/auth";
import { collect } from "@/lib/collector";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin()))
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  try {
    return Response.json(await collect());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Сбой сбора" },
      { status: 503 },
    );
  }
}
