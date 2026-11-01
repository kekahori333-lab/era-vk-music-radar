import "../lib/load-env";
import { daily } from "../lib/daily";
import { closeDatabases } from "../lib/db";
daily()
  .then(console.log)
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(closeDatabases);
