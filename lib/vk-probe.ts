import { vk, wallIds, VkError, postSchema, extractTracks } from "./vk";
export type ProbeCheck = {
  method: "users.get" | "wall.get" | "newsfeed.search";
  status: "available" | "denied" | "failed" | "skipped";
  message: string;
  posts?: number;
  audio?: number;
  code?: number;
};
export type ProbeReport = {
  configured: boolean;
  checkedAt: string;
  profile: { id: number; name: string; url: string } | null;
  checks: ProbeCheck[];
  coverage: string;
};
export async function probeVk(): Promise<ProbeReport> {
  const report: ProbeReport = {
    configured: !!process.env.VK_ACCESS_TOKEN,
    checkedAt: new Date().toISOString(),
    profile: null,
    checks: [],
    coverage:
      "Проверка не подтверждает полный охват VK. Отсутствие audio в ответе не доказывает запрет доступа к музыке.",
  };
  if (!report.configured) return report;
  const walls = wallIds();
  for (const method of ["users.get", "wall.get", "newsfeed.search"] as const) {
    if (method === "wall.get" && !walls.length) {
      report.checks.push({
        method,
        status: "skipped",
        message: "Задайте VK_WALL_IDS для проверки выбранной стены.",
      });
      continue;
    }
    try {
      const data = await vk(
        method,
        method === "wall.get"
          ? { owner_id: walls[0], count: 10 }
          : method === "newsfeed.search"
            ? { q: "музыка", count: 10 }
            : {},
      );
      if (method === "users.get") {
        const user = Array.isArray(data) ? data[0] : undefined;
        if (
          !user ||
          !Number.isSafeInteger(user.id) ||
          user.id <= 0 ||
          typeof user.first_name !== "string" ||
          typeof user.last_name !== "string"
        )
          throw new Error("Unexpected response");
        report.profile = {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          url: `https://vk.com/id${user.id}`,
        };
        report.checks.push({
          method,
          status: "available",
          message: "Определена страница владельца пользовательского токена.",
        });
      } else {
        if (!Array.isArray(data.items)) throw new Error("Unexpected response");
        let audio = 0;
        for (const raw of data.items) {
          const parsed = postSchema.safeParse(raw);
          if (parsed.success) audio += extractTracks(parsed.data).length;
        }
        report.checks.push({
          method,
          status: "available",
          posts: data.items.length,
          audio,
          message:
            "Метод ответил. Показаны только фактически доступные публикации и аудиовложения.",
        });
      }
    } catch (error) {
      // Return only controlled diagnostics; never raw provider/network responses or tokens.
      report.checks.push(
        error instanceof VkError
          ? {
              method,
              status: "denied",
              code: error.code,
              message: `VK отказал в запросе (код ${error.code}). Проверьте тип токена и разрешения приложения.`,
            }
          : {
              method,
              status: "failed",
              message:
                "Не удалось проверить метод: проверьте сеть, тип токена и ответ VK. Для сервисного токена определение личной страницы может быть недоступно.",
            },
      );
    }
  }
  return report;
}
