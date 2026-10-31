import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallIds } from "@/lib/vk";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdmin()))
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  try {
    return Response.json(
      {
        vkConfigured: !!process.env.VK_ACCESS_TOKEN,
        walls: wallIds(),
        runs: (
          await db().query(
            "SELECT * FROM collection_runs ORDER BY id DESC LIMIT 20",
          )
        ).rows,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Не удалось прочитать состояние. Проверьте БД и VK_WALL_IDS." },
      { status: 503 },
    );
  }
}
