// Corre todas las suites en orden. Salida distinta de 0 si algo falla.
import { execSync } from "node:child_process";
const suites = ["tests/audit.mjs", "tests/run.mjs", "tests/tactics.mjs", "tests/probe.mjs", "tests/real.mjs"];
let failed = 0;
for (const f of suites) {
  console.log(`\n########## ${f} ##########`);
  try { execSync(`node ${f}`, { stdio: "inherit" }); }
  catch { failed++; }
}
process.exit(failed ? 1 : 0);
