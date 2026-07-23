// Suite 3 — pipeline completo contra actores REALES de la mesa.
import fs from "node:fs";
import { extractPC, extractNPC } from "../scripts/extract.mjs";
import { analyze } from "../scripts/analyze.mjs";
import { renderText } from "../scripts/i18n.mjs";
import { useLang } from "./_dict.mjs";

const DIR = "/mnt/user-data/uploads";
const F = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(x => x.startsWith("fvtt-Actor")) : [];
if (!F.length) { console.log("(sin probes disponibles — se omite)"); process.exit(0); }
const load = n => JSON.parse(fs.readFileSync(`${DIR}/${n}`, "utf8"));
const short = s => s.length > 26 ? s.split(" ").slice(0, 2).join(" ") : s;

const members = F.filter(f => /ofelia|gpt-o|caida/.test(f))
  .map(f => { const p = extractPC(load(f)); p.name = short(p.name); return p; });
const beholder = extractNPC(load(F.find(f => /beholder/.test(f))), 1);
const wraiths  = extractNPC(load(F.find(f => /aparicion/.test(f))), 3);

for (const lang of ["es", "en"]) {
  useLang(lang);
  for (const [label, monsters] of [["BEHOLDER (VD 13)", [beholder]], ["3× APARICIÓN (VD 5)", [wraiths]]]) {
    console.log(`\n\n########## [${lang}] ${label} ##########\n`);
    console.log(renderText(analyze({ members }, { monsters })));
  }
}
