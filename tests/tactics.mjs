// Suite 4 — chequeos nuevos de v0.2.0 y planificador táctico.
import { analyze, SEV } from "../scripts/analyze.mjs";
import { planTurns } from "../scripts/tactics.mjs";
import { localizePlan, renderText } from "../scripts/i18n.mjs";
import { useLang } from "./_dict.mjs";

useLang("es");
let pass = 0, fail = 0;
const assert = (cond, label) => { cond ? pass++ : (fail++, console.log(`  ✗ ${label}`)); };
const hasKey = (r, key) => r.checks.some((c) => c.key === key);
const sevOf = (r, key) => r.checks.find((c) => c.key === key)?.sev;

// --- Grupo base --------------------------------------------------------------
const party = { members: [
  { name: "Mago",    level: 8, ac: 12, hpMax: 40, saves: { str: -1, dex: 2, con: 3, int: 7, wis: 4, cha: 0 }, damageTypes: ["fire", "force"],       hasRanged: true },
  { name: "Bárbaro", level: 8, ac: 16, hpMax: 85, saves: { str: 7,  dex: 2, con: 7, int: -1, wis: 1, cha: 0 }, damageTypes: ["slashing"],           hasRanged: false },
  { name: "Clériga", level: 8, ac: 18, hpMax: 60, saves: { str: 2,  dex: 1, con: 4, int: 1, wis: 8, cha: 4 }, damageTypes: ["radiant", "bludgeoning"], hasRanged: false },
]};

// =============================================================================
//  Inmunidad parcial — el hueco que se perdía (dragón rojo vs mago de fuego)
// =============================================================================
{
  const dragon = { name: "Dragón rojo", cr: 17, count: 1,
    resist: [], immune: ["fire"], vulnerable: [], saveEffects: [], attacks: [], moves: [] };
  const r = analyze(party, { monsters: [dragon] });
  assert(hasKey(r, "GGEL.note.dmgPartialImmune"), "Inmunidad parcial detectada (fuego del mago)");
  assert(sevOf(r, "GGEL.note.dmgPartialImmune") === SEV.THREAT,
    "Perder la mitad de las vías de daño es amenaza, no simple fricción");
  assert(!hasKey(r, "GGEL.note.dmgNeutralized"),
    "No se marca como neutralizado: al mago le queda fuerza");
}

// El caso opuesto: si TODO su daño es inmune, sí es neutralización total.
{
  const m = { name: "Espectro", cr: 5, count: 1, resist: [], immune: ["slashing"],
    vulnerable: [], saveEffects: [], attacks: [], moves: [] };
  const r = analyze({ members: [party.members[1]] }, { monsters: [m] });
  assert(hasKey(r, "GGEL.note.dmgNeutralized"), "Inmunidad total sigue detectándose");
}

// =============================================================================
//  Punto débil transversal — dos monstruos distintos castigando la misma save
// =============================================================================
{
  const mk = (name) => ({ name, cr: 5, count: 1, resist: [], immune: [], vulnerable: [],
    saveEffects: [{ name: `${name}: efecto`, ability: "dex", dc: 16 }],
    attacks: [], moves: [] });
  const r = analyze(party, { monsters: [mk("Bicho A"), mk("Bicho B")] });
  assert(hasKey(r, "GGEL.note.softSpot"), "Punto débil transversal detectado (DES × 2 monstruos)");

  // Un solo monstruo NO alcanza: sería una amenaza puntual, no un agujero.
  const solo = analyze(party, { monsters: [mk("Bicho A")] });
  assert(!hasKey(solo, "GGEL.note.softSpot"), "Un solo monstruo no dispara punto débil");
}

// =============================================================================
//  Planificador táctico
// =============================================================================
const boss = {
  name: "Tirano", cr: 13, count: 1, resist: [], immune: [], vulnerable: [],
  saveEffects: [{ name: "Rayo paralizante", ability: "con", dc: 16 }],
  attacks: [{ name: "Mordisco", toHit: 9, avgDamage: 22 }],
  ranged: false, fly: true,
  moves: [
    { name: "Mordisco", kind: "attack", activation: "action", avgDamage: 22, toHit: 9, ability: null, dc: null, uses: null, damageTypes: ["piercing"] },
    { name: "Rayo paralizante", kind: "save", activation: "action", avgDamage: 0, toHit: null, ability: "con", dc: 16, uses: null, damageTypes: [] },
    { name: "Aliento", kind: "save", activation: "action", avgDamage: 45, toHit: null, ability: "dex", dc: 18, uses: { type: "recharge", formula: "5" }, damageTypes: ["fire"] },
    { name: "Coletazo", kind: "attack", activation: "legendary", avgDamage: 12, toHit: 9, ability: null, dc: null, uses: null, damageTypes: ["bludgeoning"] },
  ],
};

{
  const plan = planTurns(party, { monsters: [boss] }, { rounds: 3 });
  assert(plan.rounds.length === 3, "Genera las 3 rondas pedidas");

  const names = plan.rounds.map((r) => r.entries.find((e) => e.activation === "action")?.data.move);
  assert(new Set(names).size > 1, "No repite la misma movida todas las rondas (hay variedad)");

  const legendary = plan.rounds[0].entries.some((e) => e.activation === "legendary");
  assert(legendary, "Incluye la acción legendaria aparte del turno");

  // El recurso con recarga no puede aparecer en rondas consecutivas.
  const alientoRounds = plan.rounds
    .filter((r) => r.entries.some((e) => e.data.move === "Aliento"))
    .map((r) => r.n);
  assert(alientoRounds.length < 2 || alientoRounds[1] - alientoRounds[0] >= 2,
    "Respeta la recarga: no usa el aliento en rondas seguidas");

  assert(plan.contingencies.length >= 2, "Produce contingencias");
  assert(plan.contingencies.some((c) => c.key.includes("pcDown")), "Contempla la caída de un PJ");
  assert(plan.contingencies.some((c) => c.key.includes("fly")), "Contempla que el volador se eleve");

  const L = localizePlan(plan);
  const texts = [
    ...L.rounds.flatMap((r) => [r.label, ...r.entries.flatMap((e) => [e.head, e.body])]),
    ...L.contingencies.flatMap((c) => [c.head, c.body]),
  ];
  assert(!texts.some((s) => s.includes("GGEL.")), "Todas las claves del plan resuelven");
  assert(!texts.some((s) => /\{\w+\}/.test(s)), "No quedan marcadores sin interpolar");
}

// El plan no debe romperse con entradas vacías.
{
  const empty = planTurns({ members: [] }, { monsters: [] });
  assert(empty.empty === true && empty.rounds.length === 0, "Maneja grupo/encuentro vacío");
}




console.log(`\n${fail === 0 ? "✓ TODO OK" : "✗ HAY FALLOS"} — ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
