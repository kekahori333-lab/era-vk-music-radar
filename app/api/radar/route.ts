import { radar } from "@/lib/radar";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(await radar(new URL(request.url).searchParams));
  } catch {
    return Response.json(
      {
        available: false,
        tracks: [],
        total: 0,
        summary: { publications: 0, originals: 0, reposts: 0, authors: 0 },
        lastRun: null,
        coverage: "Наблюдаемая выборка публичных стен",
        message:
          "Данные пока недоступны. Администратору необходимо настроить PostgreSQL и запустить сбор.",
      },
      { status: 503 },
    );
  }
}
