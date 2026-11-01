import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
export const CSV_HEADERS = "исполнитель;трек;дата;ссылка;автор;репост";
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
export class ImportError extends Error {}
export type ImportRow = {
  postId: string;
  ownerId: number;
  authorId: number;
  publishedAt: string;
  url: string;
  repost: boolean;
  trackId: string;
  artist: string;
  title: string;
};
const aliases: Record<string, string> = {
  исполнитель: "artist",
  трек: "title",
  дата: "published_at",
  ссылка: "url",
  автор: "author_id",
  репост: "is_repost",
  artist: "artist",
  title: "title",
  published_at: "published_at",
  url: "url",
  author_id: "author_id",
  is_repost: "is_repost",
};
function dateValue(value: string, now: number) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match)
    throw new ImportError(
      "Дата должна быть ISO 8601 с часовым поясом, например YYYY-MM-DDTHH:mm:ss+03:00.",
    );
  const [y, m, d, h, min, sec] = match.slice(1, 7).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  const timestamp = Date.parse(value);
  if (
    y < 2006 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    min > 59 ||
    sec > 59 ||
    !Number.isFinite(timestamp) ||
    timestamp > now
  )
    throw new ImportError("Некорректная дата или дата в будущем.");
  return new Date(timestamp).toISOString();
}
export function parseImport(text: string, now = Date.now()): ImportRow[] {
  if (Buffer.byteLength(text, "utf8") > MAX_CSV_BYTES)
    throw new ImportError("CSV больше 2 МБ.");
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      delimiter: text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",",
      skip_empty_lines: true,
      max_record_size: 10000,
    });
  } catch {
    throw new ImportError(
      "Не удалось разобрать CSV: проверьте кавычки, разделитель и число столбцов.",
    );
  }
  if (records.length < 2)
    throw new ImportError("CSV содержит только заголовок или пуст.");
  if (records.length - 1 > MAX_CSV_ROWS)
    throw new ImportError("В одном файле допускается до 5000 строк.");
  const header = records[0].map((h) => aliases[h.trim().toLowerCase()]);
  if (
    header.length !== 6 ||
    header.some((h) => !h) ||
    new Set(header).size !== 6
  )
    throw new ImportError("Нужны столбцы: " + CSV_HEADERS);
  const metadata = new Map<string, string>();
  return records.slice(1).map((values, index) => {
    try {
      const row = Object.fromEntries(
        header.map((key, i) => [key, values[i].trim()]),
      );
      const artist = row.artist.normalize("NFKC").replace(/\s+/g, " ").trim(),
        title = row.title.normalize("NFKC").replace(/\s+/g, " ").trim();
      if (
        !artist ||
        !title ||
        artist.length > 300 ||
        title.length > 500 ||
        /[\u0000-\u001f]/.test(artist + title)
      )
        throw new ImportError(
          "Исполнитель и трек обязательны (до 300/500 символов).",
        );
      let url: URL;
      try {
        url = new URL(row.url);
      } catch {
        throw new ImportError("Нужна полная HTTPS-ссылка на пост VK.");
      }
      const post = /^\/wall(-?[1-9]\d*)_([1-9]\d*)\/?$/.exec(url.pathname);
      if (
        url.protocol !== "https:" ||
        !["vk.com", "vk.ru", "www.vk.com", "www.vk.ru"].includes(
          url.hostname,
        ) ||
        url.username ||
        url.password ||
        url.port ||
        !post ||
        !Number.isSafeInteger(Number(post[1])) ||
        !Number.isSafeInteger(Number(post[2]))
      )
        throw new ImportError(
          "Допустимы ссылки https://vk.com/wall… или https://vk.ru/wall… с числовым ID.",
        );
      if (
        !/^-?[1-9]\d*$/.test(row.author_id) ||
        !Number.isSafeInteger(Number(row.author_id))
      )
        throw new ImportError(
          "Автор — ненулевой числовой VK ID, не имя или ссылка.",
        );
      const bool = row.is_repost.toLowerCase();
      if (!["0", "1", "false", "true", "нет", "да"].includes(bool))
        throw new ImportError("Репост: 1/0 или да/нет.");
      const repost = ["1", "true", "да"].includes(bool),
        publishedAt = dateValue(row.published_at, now),
        postId = post[1] + "_" + post[2];
      const signature = JSON.stringify([row.author_id, publishedAt, repost]);
      if (metadata.has(postId) && metadata.get(postId) !== signature)
        throw new ImportError(
          "У одного поста разные автор, дата или тип публикации.",
        );
      metadata.set(postId, signature);
      return {
        postId,
        ownerId: Number(post[1]),
        authorId: Number(row.author_id),
        publishedAt,
        repost,
        url: `https://vk.com/wall${postId}`,
        artist,
        title,
        trackId:
          "csv:" +
          createHash("sha256")
            .update(JSON.stringify([artist.toLowerCase(), title.toLowerCase()]))
            .digest("hex"),
      };
    } catch (e) {
      throw new ImportError(
        `Строка ${index + 2}: ${e instanceof ImportError ? e.message : "Некорректные данные."}`,
      );
    }
  });
}
export function importPreview(rows: ImportRow[]) {
  return {
    rows: rows.length,
    posts: new Set(rows.map((r) => r.postId)).size,
    tracks: new Set(rows.map((r) => r.trackId)).size,
    from: rows.reduce(
      (v, r) => (r.publishedAt < v ? r.publishedAt : v),
      rows[0].publishedAt,
    ),
    to: rows.reduce(
      (v, r) => (r.publishedAt > v ? r.publishedAt : v),
      rows[0].publishedAt,
    ),
    sample: rows
      .slice(0, 5)
      .map((r) => ({
        artist: r.artist,
        title: r.title,
        url: r.url,
        date: r.publishedAt,
      })),
  };
}
