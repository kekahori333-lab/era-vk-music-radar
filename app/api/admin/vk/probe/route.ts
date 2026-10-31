import { isAdmin, sameOrigin } from "@/lib/auth";
import { probeVk } from "@/lib/vk-probe";
export const maxDuration = 90;
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin()))
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  try {
    return Response.json(await probeVk(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Проверьте настройку VK_WALL_IDS." },
      { status: 503 },
    );
  }
}
