import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db, closeDatabases } from "../lib/db";
import { radar } from "../lib/radar";
import { collect } from "../lib/collector";
test(
  "PostgreSQL: collection is idempotent, ranking/search/periods/snapshots/sources work",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const schema = "test_" + randomUUID().replaceAll("-", "");
    const admin = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("options", `-csearch_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    process.env.DATABASE_URL_UNPOOLED = url.toString();
    const originalFetch = globalThis.fetch;
    try {
      await db().query(
        await readFile(
          new URL("../scripts/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      process.env.VK_ACCESS_TOKEN = "test-only-not-a-real-credential";
      process.env.VK_WALL_IDS = "-123";
      const now = Math.floor(Date.now() / 1000);
      globalThis.fetch = async () =>
        Response.json({
          response: {
            count: 4,
            items: [
              {
                id: 1,
                owner_id: -123,
                from_id: 9,
                date: now - 50,
                attachments: [
                  {
                    type: "audio",
                    audio: {
                      owner_id: 1,
                      id: 2,
                      artist: "Артист",
                      title: "Сигнал",
                    },
                  },
                ],
              },
              {
                id: 2,
                owner_id: -123,
                from_id: 10,
                date: now - 100,
                copy_history: [
                  {
                    attachments: [
                      {
                        type: "audio",
                        audio: {
                          owner_id: 1,
                          id: 2,
                          artist: "Артист",
                          title: "Сигнал",
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: 3,
                owner_id: -123,
                from_id: 10,
                date: now - 200,
                attachments: [
                  {
                    type: "audio",
                    audio: {
                      owner_id: 1,
                      id: 2,
                      artist: "Артист",
                      title: "Сигнал",
                    },
                  },
                ],
              },
              {
                id: 4,
                owner_id: -123,
                from_id: 11,
                date: now - 3 * 86400,
                attachments: [
                  {
                    type: "audio",
                    audio: {
                      owner_id: 1,
                      id: 5,
                      artist: "Другой",
                      title: "Архив",
                    },
                  },
                ],
              },
            ],
          },
        });
      await collect();
      await collect();
      assert.equal(
        (await db().query("SELECT count(*) FROM posts")).rows[0].count,
        "4",
      );
      assert.equal(
        (await db().query("SELECT count(*) FROM snapshots")).rows[0].count,
        "5",
      );
      const day = await radar(new URLSearchParams("period=1&limit=100"));
      assert.equal(day.tracks.length, 1);
      assert.equal(day.tracks[0].publications, 3);
      assert.equal(day.tracks[0].originals, 2);
      assert.equal(day.tracks[0].reposts, 1);
      assert.equal(day.tracks[0].authors, 2);
      assert.equal(day.tracks[0].sources.length, 3);
      assert.equal(day.tracks[0].previousPosition, null);
      assert.equal(day.summary.publications, 3);
      assert.equal(
        (await radar(new URLSearchParams("period=7"))).tracks.length,
        2,
      );
      assert.equal(
        (await radar(new URLSearchParams("q=артиСТ"))).tracks.length,
        1,
      );
      assert.equal(
        (await radar(new URLSearchParams("q=отсутствует"))).tracks.length,
        0,
      );
      assert.equal(
        (await radar(new URLSearchParams("hits=1"))).tracks.length,
        1,
      );
      await db().query(
        "INSERT INTO snapshots VALUES((now() AT TIME ZONE 'UTC')::date-1,'1_2',1,5,2,1,1,2)",
      );
      assert.equal(
        (await radar(new URLSearchParams())).tracks[0].previousPosition,
        5,
      );
      // An API permission error produces a failed run; tokens are never included.
      globalThis.fetch = async () =>
        Response.json({
          error: { error_code: 15, error_msg: "Access denied" },
        });
      await assert.rejects(collect(), /ошибка 15/);
      assert.equal(
        (
          await db().query(
            "SELECT status FROM collection_runs ORDER BY id DESC LIMIT 1",
          )
        ).rows[0].status,
        "failed",
      );
    } finally {
      globalThis.fetch = originalFetch;
      await closeDatabases();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
