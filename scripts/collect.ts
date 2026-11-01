import "../lib/load-env";
import { collect } from "../lib/collector";
import { closeDatabases } from "../lib/db";
collect()
  .then(console.log)
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabases());
