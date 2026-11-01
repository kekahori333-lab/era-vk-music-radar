import type { PoolClient } from "pg";

// Caller owns a transaction and the shared collection lock.
export async function saveSnapshots(client: PoolClient) {
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
}
