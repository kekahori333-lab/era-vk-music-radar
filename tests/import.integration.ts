import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db, closeDatabases } from "../lib/db";
import { importCsv } from "../lib/importer";
import { CSV_HEADERS } from "../lib/import-csv";
import { radar } from "../lib/radar";
import { daily } from "../lib/daily";
test(
  "CSV import: atomic writes, deduplication, source disclosure, ranking and daily snapshots without VK",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const admin = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await admin.connect();
    const schema = "import_" + randomUUID().replaceAll("-", "");
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-csearch_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    process.env.DATABASE_URL_UNPOOLED = url.toString();
    delete process.env.VK_ACCESS_TOKEN;
    delete process.env.VK_WALL_IDS;
    try {
      await db().query(
        await readFile(
          new URL("../scripts/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      const date = new Date(Date.now() - 3600000).toISOString(),
        old = new Date(Date.now() - 3 * 86400000).toISOString();
      const make = (id: number, title = "Сигнал", time = date) =>
        `Артист;${title};${time};https://vk.com/wall-700_${id};${id === 2 ? 11 : 10};${id === 2 ? 1 : 0}`;
      const csv =
        CSV_HEADERS +
        "\n" +
        [make(1), make(1), make(2), make(3), make(4, "Архив", old)].join("\n");
      const imported = await importCsv(csv, "Разрешённая тестовая выгрузка");
      assert.equal(imported.newPosts, 4);
      assert.equal(imported.newLinks, 4);
      const retry = await importCsv(csv, "Та же выгрузка");
      assert.equal(retry.newPosts, 0);
      assert.equal(retry.newLinks, 0);
      const day = await radar(new URLSearchParams("period=1"));
      assert.equal(day.dataSource, "import");
      assert.match(day.coverage, /CSV/);
      assert.equal(day.tracks.length, 1);
      assert.equal(day.tracks[0].publications, 3);
      assert.equal(day.tracks[0].originals, 2);
      assert.equal(day.tracks[0].reposts, 1);
      assert.equal(day.tracks[0].authors, 2);
      assert.equal(day.tracks[0].sources.length, 3);
      assert.equal(day.summary.publications, 3);
      assert.equal(
        (await radar(new URLSearchParams("period=7"))).tracks.length,
        2,
      );
      assert.equal(
        (await radar(new URLSearchParams("hits=1"))).tracks.length,
        1,
      );
      const before = (
        await db().query("SELECT count(*) n FROM collection_runs")
      ).rows[0].n;
      await assert.rejects(
        importCsv(
          CSV_HEADERS + "\n" + make(5) + "\n" + make(1, "Сигнал", old),
          "Конфликтующая выгрузка",
        ),
        /другими данными/,
      );
      assert.equal(
        (await db().query("SELECT count(*) n FROM posts")).rows[0].n,
        "4",
      );
      assert.equal(
        (await db().query("SELECT count(*) n FROM collection_runs")).rows[0].n,
        before,
      );
      assert.deepEqual(await daily(), { mode: "snapshots", ok: true });
      assert.equal(
        (await db().query("SELECT count(*) n FROM snapshots")).rows[0].n,
        "5",
      );
      const locker = await db().connect();
      try {
        await locker.query("SELECT pg_advisory_lock(7342901)");
        await assert.rejects(importCsv(csv, "Занятая выборка"), /выполняется/);
      } finally {
        await locker.query("SELECT pg_advisory_unlock(7342901)");
        locker.release();
      }
      await db().query("INSERT INTO tracks VALUES('99_88','API','Трек API')");
      await db().query("INSERT INTO posts VALUES($1,-700,10,$2,false,$3)", [
        "-700_90",
        date,
        "https://vk.com/wall-700_90",
      ]);
      await db().query("INSERT INTO post_tracks VALUES('-700_90','99_88')");
      assert.equal((await radar(new URLSearchParams())).dataSource, "mixed");
      await assert.rejects(
        importCsv(CSV_HEADERS + "\n" + make(90), "Данные из API"),
        /уже получен через API/,
      );
    } finally {
      await closeDatabases();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
