// Suite 1 — fixtures sintéticas: cada regla del motor en aislado.
import { analyze, SEV } from "../scripts/analyze.mjs";
import { renderText } from "../scripts/i18n.mjs";
import { useLang } from "./_dict.mjs";

useLang("es");
let pass = 0, fail = 0;
const assert = (cond, label) => { cond ? pass++ : (fail++, console.log(`  ✗ ${label}`)); };
const hasKey = (r, sev, key) => r.checks.some(c => c.sev === sev && c.key === key);

const party = { members: [
  { name:"Guerrero", level:6, ac:18, hpMax:58, saves:{str:6,dex:1,con:5,int:0,wis:1,cha:0}, damageTypes:["slashing"], hasRanged:false },
  { name:"Pícara",   level:6, ac:15, hpMax:40, saves:{str:0,dex:7,con:2,int:4,wis:2,cha:1}, damageTypes:["piercing"], hasRanged:true },
  { name:"Mago",     level:6, ac:12, hpMax:32, saves:{str:-1,dex:2,con:3,int:7,wis:4,cha:0}, damageTypes:["fire","force"], hasRanged:true },
  { name:"Clériga",  level:6, ac:18, hpMax:45, saves:{str:2,dex:0,con:3,int:0,wis:7,cha:3}, damageTypes:["bludgeoning","radiant"], hasRanged:false },
]};

const encounter = { monsters: [
  { name:"Esqueleto", cr:0.25, count:4, resist:[], immune:["poison"], vulnerable:["bludgeoning"],
    saveEffects:[], attacks:[{name:"espada corta",toHit:4,avgDamage:6}], ranged:false, fly:false },
  { name:"Golem de hueso", cr:6, count:1, resist:["slashing","piercing"], immune:["poison"], vulnerable:[],
    saveEffects:[{name:"aliento",ability:"con",dc:15}], attacks:[{name:"mazazo",toHit:8,avgDamage:22}], ranged:false, fly:false },
  { name:"Pteranodon", cr:0.25, count:2, resist:[], immune:[], vulnerable:[],
    saveEffects:[], attacks:[{name:"pico",toHit:5,avgDamage:8}], ranged:false, fly:true },
]};

const r = analyze(party, encounter);
console.log("=== Informe de muestra (es) ===\n");
console.log(renderText(r));
console.log("\n=== Aserciones ===");

assert(hasKey(r, SEV.FRICTION, "GGEL.note.dmgResistedHalf"), "C1: golem resiste a media party");
assert(hasKey(r, SEV.ADVANTAGE, "GGEL.note.dmgVulnerable"), "C1: vulnerabilidad a contundente");
assert(hasKey(r, SEV.FRICTION, "GGEL.note.saveSingle") || hasKey(r, SEV.THREAT, "GGEL.note.saveSingle"), "C2: aliento CON CD15");
assert(hasKey(r, SEV.FRICTION, "GGEL.note.reachPartial"), "C3: melee sin blanco vs voladores");
assert(r.checks.some(c => c.key === "GGEL.note.economy"), "C4: economía de acción 7v4");
assert(hasKey(r, SEV.THREAT, "GGEL.note.defensive"), "C5: mago como eslabón débil");
assert(r.baseline.sev === SEV.INFO && r.baseline.key === "GGEL.note.baseline", "Baseline es solo contexto");
assert(r.verdict === "GGEL.verdict.threat", "Veredicto refleja banderas rojas");
assert(!renderText(r).includes("GGEL."), "Todas las claves i18n resuelven (sin claves crudas)");

console.log(`\n${fail === 0 ? "✓ TODO OK" : "✗ HAY FALLOS"} — ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
