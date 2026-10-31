import { radar, toCsv } from "@/lib/radar";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const data = await radar(new URL(request.url).searchParams);
    return new Response(toCsv(data.tracks), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="era-radar.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Экспорт недоступен: проверьте подключение к базе данных" },
      { status: 503 },
    );
  }
}
