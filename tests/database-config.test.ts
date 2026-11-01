import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseUrl } from "../lib/db";
test("web requests use pooler; migrations and session locks require direct connections", () => {
  const app = process.env.DATABASE_URL,
    direct = process.env.DATABASE_URL_UNPOOLED;
  try {
    process.env.DATABASE_URL =
      "postgresql://test@ep-test-pooler.us-east-2.aws.neon.tech/db";
    delete process.env.DATABASE_URL_UNPOOLED;
    assert.equal(databaseUrl(), process.env.DATABASE_URL);
    assert.throws(() => databaseUrl("direct"), /DATABASE_URL_UNPOOLED/);
    process.env.DATABASE_URL_UNPOOLED =
      "postgresql://test@ep-test.us-east-2.aws.neon.tech/db";
    assert.equal(databaseUrl("direct"), process.env.DATABASE_URL_UNPOOLED);
    process.env.DATABASE_URL = "postgresql://test@localhost/db";
    delete process.env.DATABASE_URL_UNPOOLED;
    assert.equal(databaseUrl("direct"), process.env.DATABASE_URL);
    delete process.env.DATABASE_URL;
    assert.throws(() => databaseUrl(), /не настроен/);
  } finally {
    if (app === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = app;
    if (direct === undefined) delete process.env.DATABASE_URL_UNPOOLED;
    else process.env.DATABASE_URL_UNPOOLED = direct;
  }
});
