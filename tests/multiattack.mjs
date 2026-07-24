// Suite 5 — detección de multiataque.
// -----------------------------------------------------------------------------
// dnd5e NO guarda la rutina de multiataque de forma estructurada: vive en la
// prosa. La detección se basa en la FORMA (rasgo de monstruo sin mecánica cuya
// descripción nombra sus propios ataques), no en la palabra "Multiattack".
// Estos casos prueban justamente eso: el mismo dragón en inglés y en español
// tiene que dar el mismo resultado.
import { extractNPC } from "../scripts/extract.mjs";

let pass = 0, fail = 0;
const assert = (cond, label) => { cond ? pass++ : (fail++, console.log(`  ✗ ${label}`)); };

/** Construye un actor PNJ mínimo con la forma real del JSON de dnd5e. */
function dragon({ multiName, description, biteName, clawName }) {
  const attack = (name, n, d) => ({
    name,
    type: "weapon",
    system: {
      damage: { base: { number: n, denomination: d, bonus: "", types: ["piercing"] } },
      activities: {
        a1: {
          type: "attack",
          activation: { type: "action" },
          attack: { ability: "str", bonus: "", flat: false, type: { value: "melee" } },
          damage: { includeBase: true, parts: [] },
        },
      },
    },
  });

  return {
    name: "Dragón",
    type: "npc",
    system: {
      details: { cr: 13 },
      abilities: { str: { value: 22 }, dex: { value: 10 }, con: { value: 21 } },
      traits: {},
      attributes: { movement: { fly: 80 } },
    },
    items: [
      attack(biteName, 2, 10),
      attack(clawName, 2, 6),
      {
        name: multiName,
        type: "feat",
        system: {
          type: { value: "monster", subtype: "" },
          description: { value: `<p>${description}</p>` },
          activities: {},
        },
      },
    ],
  };
}

// --- Inglés ------------------------------------------------------------------
{
  const d = extractNPC(dragon({
    multiName: "Multiattack",
    biteName: "Bite",
    clawName: "Claw",
    description: "The dragon makes three attacks: one with its bite and two with its claws.",
  }));

  assert(!!d.multiattack, "EN: detecta el multiataque");
  assert(d.multiattack.parts.length === 2, "EN: identifica los dos ataques de la rutina");
  const bite = d.multiattack.parts.find((p) => p.name === "Bite");
  const claw = d.multiattack.parts.find((p) => p.name === "Claw");
  assert(bite?.count === 1, "EN: lee 'one with its bite' como 1");
  assert(claw?.count === 2, "EN: lee 'two with its claws' como 2 (plural incluido)");
  // 1×(2d10=11) + 2×(2d6=7) + mods de FUE (+6 cada uno)
  assert(d.multiattack.avgDamage > 30, "EN: suma el daño de la ronda completa");
}

// --- Español: mismo dragón, misma respuesta ----------------------------------
{
  const d = extractNPC(dragon({
    multiName: "Multiataque",
    biteName: "Mordisco",
    clawName: "Garra",
    description: "El dragón hace tres ataques: uno con su mordisco y dos con sus garras.",
  }));

  assert(!!d.multiattack, "ES: detecta el multiataque sin depender de la palabra inglesa");
  const mordisco = d.multiattack.parts.find((p) => p.name === "Mordisco");
  const garra = d.multiattack.parts.find((p) => p.name === "Garra");
  assert(mordisco?.count === 1, "ES: lee 'uno con su mordisco' como 1");
  assert(garra?.count === 2, "ES: lee 'dos con sus garras' como 2 (plural incluido)");
}

// --- No debe inventar multiataque donde no lo hay ----------------------------
{
  const d = extractNPC(dragon({
    multiName: "Resistencia legendaria",
    biteName: "Mordisco",
    clawName: "Garra",
    description: "Si el dragón falla una tirada de salvación, puede elegir tener éxito.",
  }));
  assert(!d.multiattack, "No detecta multiataque en un rasgo que no nombra sus ataques");
}

// --- El multiataque entra al plan como movida de cada ronda ------------------
{
  const d = extractNPC(dragon({
    multiName: "Multiattack",
    biteName: "Bite",
    clawName: "Claw",
    description: "The dragon makes three attacks: one with its bite and two with its claws.",
  }));
  const mv = d.moves.find((m) => m.routine);
  assert(!!mv, "El multiataque se agrega como movida");
  assert(mv.alwaysAvailable === true, "No lo penaliza la regla de repetición");
  assert(d.attacks[0].avgDamage === d.multiattack.avgDamage,
    "La lectura defensiva mide la ronda completa, no un golpe suelto");
}

// --- Compendio a medio traducir: el caso real de Tzindelor -------------------
// Acciones "Ataque múltiple" y "Mordisco" en español, pero "Claw" quedó en
// inglés. La descripción menciona "garras", que no coincide con "Claw", así que
// la rutina exacta es ilegible. Antes esto se descartaba en silencio.
{
  const d = extractNPC(dragon({
    multiName: "Ataque múltiple",
    biteName: "Mordisco",
    clawName: "Claw",
    description: "El dragón hace tres ataques: uno con su mordisco y dos con sus garras.",
  }));

  assert(!!d.multiattack, "MIXTO: detecta el multiataque aunque la rutina no se lea");
  assert(d.multiattack.approximate === true, "MIXTO: se marca como aproximado, no inventa rutina");
  assert(d.multiattack.available.length === 2, "MIXTO: ofrece las armas para armar la ronda");
  assert(
    d.attacks[0].name !== "Ataque múltiple",
    "MIXTO: no antepone un total falso a la lectura defensiva"
  );
}

// --- Nombres en español, descripción en inglés (el reverso) ------------------
{
  const d = extractNPC(dragon({
    multiName: "Ataque múltiple",
    biteName: "Mordisco",
    clawName: "Garra",
    description: "The dragon makes three attacks: one with its bite and two with its claws.",
  }));
  assert(!!d.multiattack, "REVERSO: la pista de nombre rescata el caso");
  assert(d.multiattack.approximate === true, "REVERSO: marcado como aproximado");
}

// --- Un rasgo cualquiera sin relación no debe marcarse -----------------------
{
  const d = extractNPC(dragon({
    multiName: "Presencia aterradora",
    biteName: "Mordisco",
    clawName: "Garra",
    description: "Cada criatura a elección del dragón debe superar una salvación.",
  }));
  assert(!d.multiattack, "No marca multiataque en un rasgo que no lo es");
}

console.log(`\n${fail === 0 ? "✓ TODO OK" : "✗ HAY FALLOS"} — ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
