import { db } from "./db";
import { collect } from "./collector";
import { wallIds } from "./vk";
import { saveSnapshots } from "./snapshots";
export async function daily() {
  if (process.env.VK_ACCESS_TOKEN && wallIds().length)
    return { mode: "vk", ...(await collect()) };
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    if (
      !(await client.query("SELECT pg_try_advisory_xact_lock(7342901) locked"))
        .rows[0].locked
    )
      throw new Error("Сбор или импорт уже выполняется");
    await saveSnapshots(client);
    await client.query("COMMIT");
    return { mode: "snapshots", ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
