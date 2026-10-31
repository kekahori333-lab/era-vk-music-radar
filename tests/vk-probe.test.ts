import { test } from "node:test";
import assert from "node:assert/strict";
import { probeVk } from "../lib/vk-probe";
test("connection diagnostics distinguish missing setup, capabilities and refusal without exposing secrets", async () => {
  const oldFetch = globalThis.fetch,
    oldToken = process.env.VK_ACCESS_TOKEN,
    oldWalls = process.env.VK_WALL_IDS;
  try {
    delete process.env.VK_ACCESS_TOKEN;
    globalThis.fetch = async () => {
      throw new Error("No requests expected");
    };
    const missing = await probeVk();
    assert.equal(missing.configured, false);
    assert.equal(missing.checks.length, 0);
    process.env.VK_ACCESS_TOKEN = "test-secret-never-returned";
    process.env.VK_WALL_IDS = "123";
    globalThis.fetch = async (url) => {
      const method = String(url).split("/").at(-1);
      if (method === "users.get")
        return Response.json({
          response: [
            {
              id: 123,
              first_name: "Тест",
              last_name: "Проверки",
              other: "Do not return",
            },
          ],
        });
      if (method === "newsfeed.search")
        return Response.json({
          error: {
            error_code: 15,
            error_msg: "provider debug with test-secret-never-returned",
          },
        });
      return Response.json({
        response: {
          items: [
            {
              id: 5,
              owner_id: 123,
              date: 100,
              copy_history: [
                {
                  attachments: [
                    {
                      type: "audio",
                      audio: {
                        id: 1,
                        owner_id: 2,
                        title: "Тест",
                        artist: "Тест",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    };
    const report = await probeVk();
    assert.equal(report.profile?.url, "https://vk.com/id123");
    assert.equal(report.checks.find((c) => c.method === "wall.get")?.audio, 1);
    assert.equal(
      report.checks.find((c) => c.method === "newsfeed.search")?.code,
      15,
    );
    assert.ok(!JSON.stringify(report).includes("test-secret-never-returned"));
    assert.ok(!JSON.stringify(report).includes("Do not return"));
    delete process.env.VK_WALL_IDS;
    globalThis.fetch = async () => {
      throw new Error("raw secret provider error");
    };
    const failure = await probeVk();
    assert.equal(failure.profile, null);
    assert.equal(
      failure.checks.find((c) => c.method === "wall.get")?.status,
      "skipped",
    );
    assert.ok(!JSON.stringify(failure).includes("raw secret"));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.VK_ACCESS_TOKEN;
    else process.env.VK_ACCESS_TOKEN = oldToken;
    if (oldWalls === undefined) delete process.env.VK_WALL_IDS;
    else process.env.VK_WALL_IDS = oldWalls;
  }
});
