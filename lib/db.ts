import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
const globalDb = globalThis as unknown as {
  radarPool?: pg.Pool;
  radarDirectPool?: pg.Pool;
};
export function databaseUrl(mode: "app" | "direct" = "app") {
  const url =
    mode === "direct"
      ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
      : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не настроен");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Некорректный формат подключения к PostgreSQL");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("Ожидался PostgreSQL URL");
  // PgBouncer transaction pooling cannot safely hold session advisory locks.
  if (mode === "direct" && parsed.hostname.includes("-pooler.")) {
    throw new Error(
      "Для миграции и сбора нужен прямой DATABASE_URL_UNPOOLED: session-блокировка несовместима с PgBouncer.",
    );
  }
  return url;
}
export function db(mode: "app" | "direct" = "app") {
  const connectionString = databaseUrl(mode);
  const direct =
    mode === "direct" && connectionString !== process.env.DATABASE_URL;
  const key = direct ? "radarDirectPool" : "radarPool";
  if (!globalDb[key]) {
    const pool = new pg.Pool({
      connectionString,
      max: direct ? 2 : 6,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 5000,
    });
    if (process.env.VERCEL === "1") attachDatabasePool(pool);
    globalDb[key] = pool;
  }
  return globalDb[key]!;
}
export async function closeDatabases() {
  const pools = [globalDb.radarPool, globalDb.radarDirectPool].filter(
    (pool): pool is pg.Pool => !!pool,
  );
  delete globalDb.radarPool;
  delete globalDb.radarDirectPool;
  await Promise.all(pools.map((pool) => pool.end()));
}
