import { db } from "./db";
import { vk, wallIds, postSchema, extractTracks } from "./vk";
export async function collect() {
  const walls = wallIds();
  if (!walls.length)
    throw new Error("Задайте VK_WALL_IDS: список разрешённых публичных стен");
  if (!process.env.VK_ACCESS_TOKEN)
    throw new Error("VK_ACCESS_TOKEN не настроен");
  const client = await db().connect();
  let run: number | undefined;
  let count = 0;
  let truncated = false;
  try {
    if (
      !(await client.query("SELECT pg_try_advisory_lock(7342901) AS locked"))
        .rows[0].locked
    )
      throw new Error("Сбор уже выполняется");
    run = (
      await client.query(
        "INSERT INTO collection_runs(walls) VALUES($1) RETURNING id",
        [walls.length],
      )
    ).rows[0].id;
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    for (const wall of walls) {
      let complete = false;
      for (let offset = 0; offset < 10000; offset += 100) {
        const data = await vk("wall.get", {
          owner_id: wall,
          count: 100,
          offset,
          filter: "all",
        });
        if (!Array.isArray(data.items))
          throw new Error("VK не вернул список публикаций");
        for (const raw of data.items) {
          const post = postSchema.parse(raw);
          if (post.date < cutoff) continue;
          const tracks = extractTracks(post);
          if (!tracks.length) continue;
          await client.query("BEGIN");
          try {
            const id = `${post.owner_id}_${post.id}`;
            await client.query(
              `INSERT INTO posts VALUES($1,$2,$3,to_timestamp($4),$5,$6) ON CONFLICT(id) DO UPDATE SET author_id=EXCLUDED.author_id,is_repost=EXCLUDED.is_repost`,
              [
                id,
                post.owner_id,
                post.from_id ?? post.owner_id,
                post.date,
                !!post.copy_history?.length,
                `https://vk.com/wall${id}`,
              ],
            );
            await client.query("DELETE FROM post_tracks WHERE post_id=$1", [
              id,
            ]);
            for (const a of tracks) {
              const tid = `${a.owner_id}_${a.id}`;
              await client.query(
                "INSERT INTO tracks VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET artist=EXCLUDED.artist,title=EXCLUDED.title",
                [tid, a.artist, a.title],
              );
              await client.query(
                "INSERT INTO post_tracks VALUES($1,$2) ON CONFLICT DO NOTHING",
                [id, tid],
              );
            }
            await client.query("COMMIT");
            count++;
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          }
        }
        if (data.items.length < 100 || offset + 100 >= Number(data.count)) {
          complete = true;
          break;
        }
        // Pinned posts can be old: only stop once all unpinned posts on this page predate the window.
        const unpinned = data.items.filter(
          (p: { is_pinned?: number }) => !p.is_pinned,
        );
        if (
          unpinned.length &&
          unpinned.every((p: { date: number }) => p.date < cutoff)
        ) {
          complete = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!complete) truncated = true;
    }
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM snapshots WHERE day=(now() AT TIME ZONE 'UTC')::date",
    );
    for (const period of [1, 7, 30])
      await client.query(
        `WITH ranked AS (
 SELECT t.id,count(*)::int publications,count(*) FILTER(WHERE NOT p.is_repost)::int originals,count(*) FILTER(WHERE p.is_repost)::int reposts,count(DISTINCT p.author_id)::int authors,
 row_number() OVER(ORDER BY count(*) DESC,t.id)::int position FROM tracks t JOIN post_tracks pt ON pt.track_id=t.id JOIN posts p ON p.id=pt.post_id
 WHERE p.published_at>=now()-make_interval(hours=>$1*24) AND p.published_at<=now() GROUP BY t.id)
 INSERT INTO snapshots SELECT (now() AT TIME ZONE 'UTC')::date,id,$1,position,publications,originals,reposts,authors FROM ranked
 ON CONFLICT(day,track_id,period) DO UPDATE SET position=EXCLUDED.position,publications=EXCLUDED.publications,originals=EXCLUDED.originals,reposts=EXCLUDED.reposts,authors=EXCLUDED.authors`,
        [period],
      );
    await client.query(
      "UPDATE collection_runs SET status='success',finished_at=now(),posts=$2,truncated=$3 WHERE id=$1",
      [run, count, truncated],
    );
    await client.query("COMMIT");
    return { run, posts: count, truncated };
  } catch (e) {
    await client.query("ROLLBACK");
    if (run)
      await client.query(
        "UPDATE collection_runs SET status='failed',finished_at=now(),posts=$2,error=$3 WHERE id=$1",
        [run, count, e instanceof Error ? e.message : "Ошибка сбора"],
      );
    throw e;
  } finally {
    await client.query("SELECT pg_advisory_unlock(7342901)");
    client.release();
  }
}
