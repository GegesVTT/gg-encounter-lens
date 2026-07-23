// Suite 2 — extracción contra JSON reales exportados de la mesa.
import fs from "node:fs";
import { extractActor } from "../scripts/extract.mjs";
const DIR = "/mnt/user-data/uploads";
if (!fs.existsSync(DIR)) { console.log("(sin probes disponibles — se omite)"); process.exit(0); }
const files = fs.readdirSync(DIR).filter(x => x.startsWith("fvtt-Actor"));
if (!files.length) { console.log("(sin probes disponibles — se omite)"); process.exit(0); }
let bad = 0;
for (const f of files) {
  const { kind, data } = extractActor(JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")));
  console.log(`\n===== [${kind}] ${data.name}`);
  if (kind === "pc") {
    console.log(` nivel ${data.level} | CA ${data.ac}${data.acEstimated ? " (est.)" : ""} | PV ${data.hpMax}${data.hpEstimated ? " (est.)" : ""} | alcance: ${data.hasRanged}`);
    console.log(` saves:`, Object.entries(data.saves).map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`).join(" "));
    console.log(` reparte:`, data.damageTypes.join(", ") || "(nada)");
    if (!data.level || !data.ac || !data.hpMax) { console.log("  ✗ campos vacíos"); bad++; }
  } else {
    console.log(` VD ${data.cr} | vuela: ${data.fly}`);
    console.log(` resiste:`, data.resist.join(",") || "-", "| inmune:", data.immune.join(",") || "-");
    console.log(` ataques:`, data.attacks.map(x => `${x.name} +${x.toHit}/~${x.avgDamage}`).join(" | ") || "-");
    console.log(` salvaciones: ${data.saveEffects.length}`);
    if (data.cr === undefined) { console.log("  ✗ sin VD"); bad++; }
  }
}
console.log(`\n${bad === 0 ? "✓ extracción OK" : `✗ ${bad} actor(es) con problemas`}`);
process.exit(bad ? 1 : 0);
