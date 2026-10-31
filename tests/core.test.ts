import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTracks, wallIds, postSchema } from "../lib/vk";
import { filters, csvCell } from "../lib/radar";
import { equal, verifySession, signSession, sameOrigin } from "../lib/auth";
test("audio attachments deduplicate across original and repost", () => {
  const a = {
    type: "audio",
    audio: { owner_id: -1, id: 2, artist: "Артист", title: "Трек" },
  };
  const p = postSchema.parse({
    id: 1,
    owner_id: -5,
    date: 100,
    attachments: [a],
    copy_history: [{ attachments: [a, { type: "photo" }] }],
  });
  assert.equal(extractTracks(p).length, 1);
});
test("private or unavailable attachments produce no invented tracks", () => {
  assert.deepEqual(
    extractTracks({
      id: 1,
      owner_id: 2,
      date: 100,
      attachments: [{ type: "audio" }],
    }),
    [],
  );
});
test("ranking filters clamp invalid values and query length", () => {
  assert.deepEqual(filters(new URLSearchParams("period=99&limit=-1&hits=1")), {
    period: 1,
    limit: 100,
    q: "",
    hits: true,
  });
  assert.equal(
    filters(new URLSearchParams({ q: "a".repeat(200) })).q.length,
    120,
  );
});
test("CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("Трек;1"), '"Трек;1"');
});
test("sessions reject tampered, malformed and expired values", () => {
  process.env.SESSION_SECRET = "x".repeat(32);
  const token = signSession();
  assert.ok(verifySession(token));
  assert.ok(!verifySession(token + "x"));
  assert.ok(!verifySession("0.bad.bad"));
  assert.ok(!verifySession(""));
  assert.ok(equal("a", "a"));
  assert.ok(!equal("a", "ab"));
});
test("wall config accepts only exact numeric IDs", () => {
  process.env.VK_WALL_IDS = "-123,456,-123";
  assert.deepEqual(wallIds(), [-123, 456]);
  process.env.VK_WALL_IDS = "https://vk.com/test";
  assert.throws(() => wallIds());
  delete process.env.VK_WALL_IDS;
});

test("CSRF validates browser Host and explicit production origin", () => {
  assert.ok(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/admin/login", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
  );
  assert.ok(
    !sameOrigin(
      new Request("http://localhost:3000/api/admin/login", {
        headers: { host: "localhost:3000", origin: "https://evil.example" },
      }),
    ),
  );
  assert.ok(!sameOrigin(new Request("http://localhost:3000/api/admin/login")));
  process.env.APP_ORIGIN = "https://radar.example.com";
  assert.ok(
    sameOrigin(
      new Request("http://internal/api/admin/login", {
        headers: { origin: "https://radar.example.com" },
      }),
    ),
  );
  delete process.env.APP_ORIGIN;
});
