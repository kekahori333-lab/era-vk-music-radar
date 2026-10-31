import pg from "pg";
const globalDb = globalThis as unknown as { radarPool?: pg.Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не настроен");
  return (globalDb.radarPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 6,
    connectionTimeoutMillis: 5000,
  }));
}
