import "dotenv/config";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";
try {
  await db().query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  console.log("Схема PostgreSQL готова");
} finally {
  await db().end();
}
