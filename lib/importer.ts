import { db } from "./db";
import { saveSnapshots } from "./snapshots";
import { ImportError, parseImport, importPreview } from "./import-csv";
export async function importCsv(text: string, sourceName: string) {
  const rows = parseImport(text);
  if (
    sourceName.length < 3 ||
    sourceName.length > 100 ||
    /[\u0000-\u001f]/.test(sourceName)
  )
    throw new ImportError("Укажите название источника: от 3 до 100 символов.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    if (
      !(
        await client.query(
          "SELECT pg_try_advisory_xact_lock(7342901) AS locked",
        )
      ).rows[0].locked
    )
      throw new ImportError(
        "Сейчас выполняется сбор или импорт. Повторите позже.",
      );
    const posts = [...new Map(rows.map((row) => [row.postId, row])).values()],
      ids = posts.map((r) => r.postId);
    const existing = (
      await client.query(
        "SELECT id,author_id,published_at,is_repost FROM posts WHERE id=ANY($1::text[]) FOR UPDATE",
        [ids],
      )
    ).rows;
    const metadata = new Map(posts.map((p) => [p.postId, p]));
    for (const saved of existing) {
      const row = metadata.get(saved.id)!;
      if (
        String(saved.author_id) !== String(row.authorId) ||
        new Date(saved.published_at).toISOString() !== row.publishedAt ||
        saved.is_repost !== row.repost
      )
        throw new ImportError(
          `Пост ${row.postId} уже сохранён с другими данными. Импорт отменён.`,
        );
    }
    const api = (
      await client.query(
        "SELECT post_id FROM post_tracks WHERE post_id=ANY($1::text[]) AND track_id NOT LIKE 'csv:%' LIMIT 1",
        [ids],
      )
    ).rows[0];
    if (api)
      throw new ImportError(
        `Пост ${api.post_id} уже получен через API. Импорт отменён, чтобы не смешивать идентичность треков.`,
      );
    const inserted = await client.query(
      "INSERT INTO posts SELECT * FROM unnest($1::text[],$2::bigint[],$3::bigint[],$4::timestamptz[],$5::boolean[],$6::text[]) ON CONFLICT(id) DO NOTHING",
      [
        ids,
        posts.map((r) => r.ownerId),
        posts.map((r) => r.authorId),
        posts.map((r) => r.publishedAt),
        posts.map((r) => r.repost),
        posts.map((r) => r.url),
      ],
    );
    const tracks = [...new Map(rows.map((r) => [r.trackId, r])).values()];
    await client.query(
      "INSERT INTO tracks SELECT * FROM unnest($1::text[],$2::text[],$3::text[]) ON CONFLICT(id) DO NOTHING",
      [
        tracks.map((r) => r.trackId),
        tracks.map((r) => r.artist),
        tracks.map((r) => r.title),
      ],
    );
    const links = [
      ...new Map(rows.map((r) => [r.postId + ":" + r.trackId, r])).values(),
    ];
    const linked = await client.query(
      "INSERT INTO post_tracks SELECT * FROM unnest($1::text[],$2::text[]) ON CONFLICT DO NOTHING",
      [links.map((r) => r.postId), links.map((r) => r.trackId)],
    );
    await saveSnapshots(client);
    const run = await client.query(
      "INSERT INTO collection_runs(status,walls,posts,coverage,finished_at) VALUES('success',$1,$2,$3,now()) RETURNING id",
      [
        new Set(rows.map((r) => r.ownerId)).size,
        posts.length,
        "Импорт CSV: " + sourceName,
      ],
    );
    await client.query("COMMIT");
    return {
      ...importPreview(rows),
      run: run.rows[0].id,
      newPosts: inserted.rowCount ?? 0,
      newLinks: linked.rowCount ?? 0,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
