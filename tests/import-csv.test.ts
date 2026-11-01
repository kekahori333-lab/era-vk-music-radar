import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseImport,
  importPreview,
  CSV_HEADERS,
  MAX_CSV_ROWS,
} from "../lib/import-csv";
const date = "2026-10-25T12:00:00+03:00",
  now = Date.parse("2026-11-01T10:00:00Z");
const row = (overrides: Record<string, string> = {}) => {
  const r = {
    artist: "Артист",
    title: "Трек",
    date,
    url: "https://vk.ru/wall-123_4?from=feed",
    author: "9",
    repost: "нет",
    ...overrides,
  };
  return [r.artist, r.title, r.date, r.url, r.author, r.repost].join(";");
};
test("CSV accepts BOM, Russian headers, explicit timezone and canonicalizes source links", () => {
  const rows = parseImport("\uFEFF" + CSV_HEADERS + "\r\n" + row(), now);
  assert.equal(rows[0].publishedAt, "2026-10-25T09:00:00.000Z");
  assert.equal(rows[0].url, "https://vk.com/wall-123_4");
  assert.equal(rows[0].ownerId, -123);
  assert.equal(rows[0].repost, false);
  assert.equal(importPreview(rows).posts, 1);
});
test("CSV uses normalized track identity and counts unique posts in preview", () => {
  const rows = parseImport(
    CSV_HEADERS +
      "\n" +
      row() +
      "\n" +
      row({ artist: "АРТИСТ" }) +
      "\n" +
      row({ title: "Другой" }),
    now,
  );
  assert.equal(rows[0].trackId, rows[1].trackId);
  assert.equal(importPreview(rows).posts, 1);
  assert.equal(importPreview(rows).tracks, 2);
});
test("quoted commas and quotes are parsed with English headers", () => {
  const rows = parseImport(
    'artist,title,published_at,url,author_id,is_repost\n"Артист, другой","Трек ""А""",2026-10-25T09:00:00Z,https://vk.com/wall1_2,4,true',
    now,
  );
  assert.equal(rows[0].title, 'Трек "А"');
  assert.equal(rows[0].repost, true);
});
test("CSV rejects future dates, impossible dates, missing timezone, wrong IDs and non-VK URLs", () => {
  const invalid: Record<string, string>[] = [
    { date: "2027-01-01T00:00:00Z" },
    { date: "2026-02-30T00:00:00Z" },
    { date: "2026-10-25 12:00:00" },
    { url: "https://vk.com.evil.test/wall-123_4" },
    { url: "javascript:alert(1)" },
    { author: "name" },
    { repost: "unknown" },
  ];
  for (const overrides of invalid)
    assert.throws(
      () => parseImport(CSV_HEADERS + "\n" + row(overrides), now),
      /Строка 2/,
    );
});
test("CSV rejects contradictory post metadata, malformed CSV, wrong headers and excessive records", () => {
  assert.throws(
    () =>
      parseImport(
        CSV_HEADERS + "\n" + row() + "\n" + row({ author: "10" }),
        now,
      ),
    /разные автор/,
  );
  assert.throws(
    () => parseImport(CSV_HEADERS + '\n"unclosed', now),
    /разобрать/,
  );
  assert.throws(() => parseImport("wrong\nrow", now), /столбцы/);
  assert.throws(
    () =>
      parseImport(
        CSV_HEADERS +
          "\n" +
          Array(MAX_CSV_ROWS + 1)
            .fill(row())
            .join("\n"),
        now,
      ),
    /5000/,
  );
  assert.throws(() => parseImport(CSV_HEADERS, now), /пуст/);
});
