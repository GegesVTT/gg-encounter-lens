// GG Encounter Lens — extracción dnd5e 5.x → IR
// -----------------------------------------------------------------------------
// DOS CAMINOS (hallazgo del probe, mismo patrón que ya vimos en PF2e):
//
//   • NPC / Foundry en vivo → los valores DERIVADOS existen y se leen directo
//     (ac.flat/ac.value, hp.max, details.cr).
//   • JSON exportado de PJ  → NO hay valores derivados. Verificado en probe:
//     ac:{flat:null,calc:"default"}, hp.max:null, abilities.dex sin mod ni save,
//     details.level undefined. Foundry los calcula en runtime con
//     prepareDerivedData(). Acá hay que reconstruirlos desde los valores fuente.
//
// Regla de oro: SIEMPRE preferir el valor derivado si está presente; derivar
// solo como fallback. Así el mismo código sirve dentro de Foundry (donde todo
// está resuelto) y contra un JSON exportado (donde no).
// -----------------------------------------------------------------------------

const abilityMod = (score) => Math.floor(((score ?? 10) - 10) / 2);

// Competencia por nivel de PJ (PHB) y por CR de monstruo (DMG).
const profByLevel = (lvl) => Math.floor((Math.max(1, lvl) - 1) / 4) + 2;
const profByCR = (cr) => Math.max(2, Math.floor((Math.max(0, cr) - 1) / 4) + 2);

// Suma un bonus que puede venir como "" | "2" | "+2" | null.
function num(x) {
  if (x === null || x === undefined || x === "") return 0;
  const n = Number(String(x).replace("+", "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Promedio de NdX+B. Si la parte usa fórmula custom, no lo intentamos: se marca
// como incierto en vez de inventar un número (mejor callar que mentir).
function avgOfPart(part) {
  if (part?.custom?.enabled) return null;
  const n = part?.number ?? 0;
  const d = part?.denomination ?? 0;
  if (!n || !d) return null;
  return n * ((d + 1) / 2) + num(part.bonus);
}

// Recolecta las partes de daño de una activity, contemplando includeBase:
// el arma guarda su daño base en system.damage.base, FUERA de la activity.
function damageParts(item, act) {
  const parts = [...(act?.damage?.parts ?? [])];
  if (act?.damage?.includeBase && item?.system?.damage?.base) {
    parts.unshift(item.system.damage.base);
  }
  return parts;
}

// save.ability viene como ARRAY (["dex"]) en 5.x. La DC puede estar en
// dc.formula como número plano ("16") o requerir cálculo ("spellcasting").
function readSave(act, fallbackDC) {
  const s = act?.save;
  if (!s) return null;
  const ability = Array.isArray(s.ability) ? s.ability[0] : s.ability;
  if (!ability) return null;
  const flat = num(s.dc?.formula);
  return { ability, dc: flat || fallbackDC || 0 };
}

const isRangedRange = (r) =>
  r && r.units && !["self", "touch", ""].includes(r.units) && num(r.value) > 5;

// =============================================================================
//  PJ (type: "character")
// =============================================================================
export function extractPC(actor) {
  const sys = actor.system ?? {};
  const items = actor.items ?? [];

  // Nivel: derivado si existe; si no, sumar los niveles de los ítems de clase.
  const level =
    sys.details?.level ??
    items
      .filter((i) => i.type === "class")
      .reduce((a, i) => a + (i.system?.levels ?? 0), 0) ??
    1;
  const prof = sys.attributes?.prof ?? profByLevel(level);

  // Salvaciones: preferir el total derivado; si no, mod + competencia + bonus.
  const saves = {};
  for (const [key, ab] of Object.entries(sys.abilities ?? {})) {
    const derived = ab?.save?.value;
    saves[key] =
      typeof derived === "number"
        ? derived
        : abilityMod(ab?.value) + (ab?.proficient ? prof : 0) + num(ab?.bonuses?.save);
  }

  // CA: derivada > flat > estimación 10 + DES + armadura equipada.
  // OJO: la estimación ignora Armadura de mago y otros efectos activos, que no
  // están en el JSON. Por eso marcamos acEstimated para avisarlo en el informe.
  let ac = sys.attributes?.ac?.value ?? sys.attributes?.ac?.flat ?? null;
  let acEstimated = false;
  if (ac === null) {
    acEstimated = true;
    const dex = abilityMod(sys.abilities?.dex?.value);
    const armor = items.find(
      (i) => i.type === "equipment" && i.system?.equipped && i.system?.armor?.value
    );
    ac = armor
      ? num(armor.system.armor.value) +
        Math.min(dex, armor.system.armor.dex ?? dex) +
        num(armor.system.armor.magicalBonus)
      : 10 + dex;
  }

  // PV máx: derivado > estimación por dado de golpe medio + CON.
  let hpMax = sys.attributes?.hp?.max ?? null;
  let hpEstimated = false;
  if (!hpMax) {
    hpEstimated = true;
    const con = abilityMod(sys.abilities?.con?.value);
    let total = 0;
    for (const c of items.filter((i) => i.type === "class")) {
      const die = num(String(c.system?.hd?.denomination ?? "d8").replace("d", "")) || 8;
      const lv = c.system?.levels ?? 0;
      total += die + con + (lv - 1) * (Math.floor(die / 2) + 1 + con);
    }
    hpMax = total || sys.attributes?.hp?.value || 1;
  }

  // Tipos de daño que reparte + si tiene alcance.
  const damageTypes = new Set();
  let hasRanged = false;
  for (const it of items) {
    if (!["weapon", "spell", "feat"].includes(it.type)) continue;
    if (it.type === "weapon" && it.system?.equipped === false) continue;
    for (const act of Object.values(it.system?.activities ?? {})) {
      for (const p of damageParts(it, act))
        for (const t of p?.types ?? []) damageTypes.add(t);
      if (
        act?.attack?.type?.value === "ranged" ||
        isRangedRange(act?.range) ||
        isRangedRange(it.system?.range)
      )
        hasRanged = true;
    }
  }

  return {
    name: actor.name,
    level,
    ac,
    acEstimated,
    hpMax,
    hpEstimated,
    saves,
    damageTypes: [...damageTypes],
    hasRanged,
    fly: num(sys.attributes?.movement?.fly) > 0,
  };
}

// =============================================================================
//  Monstruo (type: "npc")
// =============================================================================
export function extractNPC(actor, count = 1) {
  const sys = actor.system ?? {};
  const cr = sys.details?.cr ?? 0;
  const prof = sys.attributes?.prof ?? profByCR(cr);
  // CD por defecto de sus efectos: 8 + comp. + mod de la habilidad de lanzamiento.
  const castAbility = sys.attributes?.spellcasting;
  const fallbackDC =
    8 + prof + abilityMod(sys.abilities?.[castAbility]?.value ?? 10);

  const saveEffects = [];
  const attacks = [];
  let ranged = false;

  for (const it of actor.items ?? []) {
    for (const act of Object.values(it.system?.activities ?? {})) {
      const sv = readSave(act, fallbackDC);
      if (sv) saveEffects.push({ name: it.name, ...sv });

      if (act?.type === "attack") {
        const parts = damageParts(it, act);
        const avg = parts.reduce((a, p) => a + (avgOfPart(p) ?? 0), 0);
        const ab = act.attack?.ability || "str";
        const toHit = act.attack?.flat
          ? num(act.attack?.bonus)
          : abilityMod(sys.abilities?.[ab]?.value) + prof + num(act.attack?.bonus);
        if (avg > 0) attacks.push({ name: it.name, toHit, avgDamage: avg });
      }
      // El alcance puede venir de un efecto de salvación (rayos oculares),
      // no solo de un ataque: hay que mirarlo en TODA activity.
      if (act?.attack?.type?.value === "ranged" || isRangedRange(act?.range)) {
        ranged = true;
      }
    }
  }

  return {
    name: actor.name,
    cr,
    count,
    resist: sys.traits?.dr?.value ?? [],
    immune: sys.traits?.di?.value ?? [],
    vulnerable: sys.traits?.dv?.value ?? [],
    conditionImmune: sys.traits?.ci?.value ?? [],
    saveEffects,
    attacks,
    ranged,
    fly: num(sys.attributes?.movement?.fly) > 0,
  };
}

// Router por tipo de actor.
export function extractActor(actor, count = 1) {
  return actor.type === "npc"
    ? { kind: "npc", data: extractNPC(actor, count) }
    : { kind: "pc", data: extractPC(actor) };
}
