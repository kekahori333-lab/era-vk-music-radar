import { z } from "zod";
import { EnvHttpProxyAgent } from "undici";
const proxyAgent =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    ? new EnvHttpProxyAgent()
    : undefined;
let nextRequestAt = 0;
export class VkError extends Error {
  constructor(public code: number) {
    super(
      `VK API: ошибка ${code}. Проверьте доступ метода, тип токена и права приложения.`,
    );
  }
}
export async function vk(
  method: "wall.get" | "newsfeed.search" | "users.get",
  params: Record<string, string | number>,
) {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new Error("VK_ACCESS_TOKEN не настроен");
  const delay = Math.max(0, nextRequestAt - Date.now());
  nextRequestAt = Date.now() + delay + 400;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    body: new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      access_token: token,
      v: process.env.VK_API_VERSION || "5.199",
    }),
    signal: AbortSignal.timeout(20000),
    ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
  });
  if (!response.ok) throw new Error(`VK HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new VkError(Number(body.error.error_code));
  if (!body.response) throw new Error("VK вернул неожиданный ответ");
  return body.response;
}
const audio = z.object({
  owner_id: z.number(),
  id: z.number(),
  artist: z.string(),
  title: z.string(),
});
export const postSchema = z.object({
  id: z.number(),
  owner_id: z.number(),
  from_id: z.number().optional(),
  date: z.number(),
  attachments: z
    .array(z.object({ type: z.string(), audio: audio.optional() }))
    .optional(),
  copy_history: z
    .array(
      z.object({
        attachments: z
          .array(z.object({ type: z.string(), audio: audio.optional() }))
          .optional(),
      }),
    )
    .optional(),
});
export type VkPost = z.infer<typeof postSchema>;
export function extractTracks(post: VkPost) {
  const attachments = [
    ...(post.attachments ?? []),
    ...(post.copy_history ?? []).flatMap((p) => p.attachments ?? []),
  ];
  return [
    ...new Map(
      attachments
        .filter((a) => a.type === "audio" && a.audio)
        .map((a) => [`${a.audio!.owner_id}_${a.audio!.id}`, a.audio!]),
    ).values(),
  ];
}
export function wallIds() {
  return [
    ...new Set(
      (process.env.VK_WALL_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          if (!/^-?[1-9]\d*$/.test(s) || !Number.isSafeInteger(Number(s)))
            throw new Error("Некорректный VK_WALL_IDS");
          return Number(s);
        }),
    ),
  ];
}
