import "dotenv/config";
import { collect } from "../lib/collector";
import { db } from "../lib/db";
collect()
  .then(console.log)
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db().end());
