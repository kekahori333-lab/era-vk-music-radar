import "../lib/load-env";
import { readFile } from "node:fs/promises";
import { db, closeDatabases } from "../lib/db";
try {
  await db("direct").query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  console.log("Схема PostgreSQL готова");
} finally {
  await closeDatabases();
}
