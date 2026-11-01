import { db } from "./db";
export type Track = {
  id: string;
  artist: string;
  title: string;
  position: number;
  previousPosition: number | null;
  publications: number;
  originals: number;
  reposts: number;
  authors: number;
  growth: number | null;
  history: { day: string; publications: number }[];
  sources: { url: string; date: string; repost: boolean }[];
};
export type Radar = {
  tracks: Track[];
  total: number;
  summary: {
    publications: number;
    originals: number;
    reposts: number;
    authors: number;
  };
  coverage: string;
  dataSource?: "import" | "api" | "mixed" | "empty";
  lastRun: { finished_at: string; status: string; truncated: boolean } | null;
  available: boolean;
  message?: string;
};
export function filters(params: URLSearchParams) {
  const period = Number(params.get("period") || 1);
  const limit = Number(params.get("limit") || 100);
  return {
    period: [1, 7, 30].includes(period) ? period : 1,
    limit: [100, 500, 1000].includes(limit) ? limit : 100,
    q: (params.get("q") || "").slice(0, 120),
    hits: params.get("hits") === "1",
  };
}
export async function radar(params: URLSearchParams): Promise<Radar> {
  const { period, limit, q, hits } = filters(params);
  const pool = db();
  const result = await pool.query(
    `WITH stats AS (
 SELECT t.id,t.artist,t.title,count(*) FILTER(WHERE p.published_at>=now()-make_interval(hours=>$1*24))::int publications,
 count(*) FILTER(WHERE p.published_at>=now()-make_interval(hours=>$1*24) AND NOT p.is_repost)::int originals,
 count(*) FILTER(WHERE p.published_at>=now()-make_interval(hours=>$1*24) AND p.is_repost)::int reposts,
 count(DISTINCT p.author_id) FILTER(WHERE p.published_at>=now()-make_interval(hours=>$1*24))::int authors,
 count(*) FILTER(WHERE p.published_at<now()-make_interval(hours=>$1*24))::int previous
 FROM tracks t JOIN post_tracks pt ON pt.track_id=t.id JOIN posts p ON p.id=pt.post_id
 WHERE p.published_at>=now()-make_interval(hours=>$1*48) AND p.published_at<=now() GROUP BY t.id
 ), ranked AS (SELECT *,row_number() OVER(ORDER BY publications DESC,id)::int position FROM stats WHERE publications>0)
 SELECT r.*,s.position AS "previousPosition",
 CASE WHEN r.previous>0 THEN round((r.publications-r.previous)*100.0/r.previous)::int ELSE NULL END growth
 FROM ranked r LEFT JOIN snapshots s ON s.track_id=r.id AND s.period=$1 AND s.day=(now() AT TIME ZONE 'UTC')::date-1
 WHERE r.position<=$2 AND ($3='' OR strpos(lower(r.artist||' '||r.title),lower($3))>0)
 AND (NOT $4::boolean OR (r.publications>=3 AND (r.previous=0 OR r.publications>=r.previous*1.5)))
 ORDER BY r.position`,
    [period, limit, q, hits],
  );
  const ids = result.rows.map((r) => r.id);
  const [history, sources, summary, last, total, scope] = await Promise.all([
    pool.query(
      `SELECT track_id,to_char(p.published_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS "day",count(*)::int publications FROM post_tracks pt JOIN posts p ON p.id=pt.post_id WHERE track_id=ANY($1::text[]) AND p.published_at>=now()-interval '720 hours' AND p.published_at<=now() GROUP BY track_id,"day" ORDER BY "day"`,
      [ids],
    ),
    pool.query(
      `SELECT track_id,url,published_at date,is_repost repost FROM (SELECT pt.track_id,p.*,row_number() OVER(PARTITION BY pt.track_id ORDER BY p.published_at DESC) n FROM post_tracks pt JOIN posts p ON p.id=pt.post_id WHERE pt.track_id=ANY($1::text[]) AND p.published_at>=now()-make_interval(hours=>$2*24) AND p.published_at<=now()) x WHERE n<=5`,
      [ids, period],
    ),
    pool.query(
      `SELECT count(*)::int publications,count(*) FILTER(WHERE NOT is_repost)::int originals,count(*) FILTER(WHERE is_repost)::int reposts,count(DISTINCT author_id)::int authors FROM posts WHERE published_at>=now()-make_interval(hours=>$1*24) AND published_at<=now()`,
      [period],
    ),
    pool.query(
      "SELECT finished_at,status,truncated FROM collection_runs ORDER BY id DESC LIMIT 1",
    ),
    pool.query(
      `SELECT count(DISTINCT pt.track_id)::int total FROM post_tracks pt JOIN posts p ON p.id=pt.post_id WHERE p.published_at>=now()-make_interval(hours=>$1*24) AND p.published_at<=now()`,
      [period],
    ),
    pool.query(
      `SELECT count(*) FILTER(WHERE pt.track_id LIKE 'csv:%')::int imported,count(*) FILTER(WHERE pt.track_id NOT LIKE 'csv:%')::int api FROM post_tracks pt JOIN posts p ON p.id=pt.post_id WHERE p.published_at>=now()-make_interval(hours=>$1*24) AND p.published_at<=now()`,
      [period],
    ),
  ]);
  return {
    available: true,
    tracks: result.rows.map((r) => ({
      ...r,
      history: history.rows
        .filter((h) => h.track_id === r.id)
        .map(({ day, publications }) => ({ day, publications })),
      sources: sources.rows
        .filter((s) => s.track_id === r.id)
        .map(({ url, date, repost }) => ({ url, date, repost })),
    })),
    summary: summary.rows[0],
    lastRun: last.rows[0] ?? null,
    total: total.rows[0].total,
    dataSource: scope.rows[0].imported
      ? scope.rows[0].api
        ? "mixed"
        : "import"
      : scope.rows[0].api
        ? "api"
        : "empty",
    coverage: scope.rows[0].imported
      ? scope.rows[0].api
        ? "Смешанная выборка: импорт CSV и наблюдения VK API. Идентичность треков между источниками автоматически не объединяется. Это не весь ВКонтакте."
        : "Рейтинг по загруженным CSV. Сведения о постах и музыке предоставлены загрузившим файл; VK API их не проверял. Это не статистика всего ВКонтакте."
      : scope.rows[0].api
        ? "Только аудиовложения настроенных публичных стен, полученные VK API. Это не статистика всего ВКонтакте."
        : "Пока нет наблюдений за выбранный период. Можно импортировать реальные публикации без токена VK.",
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^(?:\s*[=+\-@]|[\t\r\n])/.test(text) ? "'" + text : text).replaceAll(
      '"',
      '""',
    ) +
    '"'
  );
}
export function toCsv(tracks: Track[]) {
  return (
    "\uFEFF" +
    [
      [
        "Позиция",
        "Исполнитель",
        "Трек",
        "Публикации",
        "Оригиналы",
        "Репосты",
        "Авторы",
        "Предыдущая позиция",
        "Рост, %",
        "Источник",
        "Охват",
      ],
      ...tracks.map((t) => [
        t.position,
        t.artist,
        t.title,
        t.publications,
        t.originals,
        t.reposts,
        t.authors,
        t.previousPosition,
        t.growth,
        t.id.startsWith("csv:")
          ? "Импорт CSV (данные администратора)"
          : "VK API",
        "Ограниченная выборка; не весь ВКонтакте",
      ]),
    ]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n")
  );
}
