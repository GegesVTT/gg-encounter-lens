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

// En dnd5e el daño base de un arma incluye el modificador de característica,
// que NO vive en las partes de daño: hay que resolverlo aparte. Sin esto, el
// Life Drain de una aparición daba 18 en vez de los 21 del stat block.
function attackAbility(item, act, sys) {
  const explicit = act?.attack?.ability;
  if (explicit) return explicit;

  const raw = item?.system?.properties;
  const props = Array.isArray(raw) ? raw : raw ? [...raw] : [];
  if (props.includes("fin")) {
    // Sutileza: se usa la mejor de las dos, como hace el sistema.
    const str = abilityMod(sys?.abilities?.str?.value);
    const dex = abilityMod(sys?.abilities?.dex?.value);
    return dex > str ? "dex" : "str";
  }
  return act?.attack?.type?.value === "ranged" ? "dex" : "str";
}

const isRangedRange = (r) =>
  r && r.units && !["self", "touch", ""].includes(r.units) && num(r.value) > 5;

// Tipos de activación jugables. Todo lo demás (rasgos pasivos, sentidos,
// resistencias narradas) NO es una movida y se descarta del plan táctico.
const ACTIVATIONS = new Set([
  "action",
  "bonus",
  "reaction",
  "legendary",
  "lair",
  "mythic",
  "special",
]);

function readActivation(item, act) {
  const raw = act?.activation?.type ?? item?.system?.activation?.type ?? "";
  return ACTIVATIONS.has(raw) ? raw : "passive";
}

// Recarga (aliento de dragón 5-6) o usos por día. Devuelve estructura, no
// texto, para que la capa de presentación lo localice.
function readUses(item, act) {
  // La recarga puede venir en tres formas segun de donde salga el stat block
  // (SRD nativo, import de terceros, o contenido migrado de dnd5e viejo).
  // Mirarlas todas evita que un aliento de dragon se repita cada ronda.
  const candidates = [act?.uses, item?.system?.uses];
  for (const uses of candidates) {
    for (const r of uses?.recovery ?? []) {
      if (r?.period === "recharge") return { type: "recharge", formula: r.formula || "" };
    }
  }

  // Forma heredada: system.recharge = { value: 5, charged: true }.
  const legacy = act?.recharge ?? item?.system?.recharge;
  if (legacy && (legacy.value != null || legacy.charged != null)) {
    return { type: "recharge", formula: legacy.value != null ? String(legacy.value) : "" };
  }

  for (const uses of candidates) {
    const max = num(uses?.max);
    if (max > 0) return { type: "limited", max };
  }
  return null;
}

// --- Multiataque -------------------------------------------------------------
// dnd5e NO guarda el multiataque de forma estructurada: la rutina vive en la
// prosa ("makes three attacks: one with its bite and two with its claws").
// Detectarlo por el nombre "Multiattack" rompe en mundos en español, así que
// usamos la FORMA, que es agnóstica del idioma:
//   1. es un rasgo de monstruo (type.value === "monster"),
//   2. no tiene mecánica propia (ni ataque, ni salvación, ni daño), y
//   3. su descripción nombra dos o más de los ataques del propio monstruo.
// El punto 3 funciona en cualquier idioma porque los nombres de los ataques y
// la descripción vienen siempre en el mismo idioma que el stat block.

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5,
};

const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const fold = (s) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Cuántas veces se hace ese ataque, leyendo el número que lo precede. */
function countBefore(text, index) {
  const window = text.slice(Math.max(0, index - 40), index);
  const tokens = window.match(/[\p{L}\d]+/gu) ?? [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tk = tokens[i];
    if (/^\d+$/.test(tk)) {
      const n = Number(tk);
      if (n >= 1 && n <= 6) return n;
    }
    if (tk in NUMBER_WORDS) return NUMBER_WORDS[tk];
  }
  return 1;
}

// Pistas de nombre/identificador. NO son la señal principal (romperían en
// idiomas no contemplados), pero rescatan el caso frecuente de compendios a
// medio traducir: acciones en español y descripción en inglés, o al revés.
const MULTIATTACK_HINTS = [
  "multiattack", "multiataque", "ataquemultiple", "ataquesmultiples",
  "attaquesmultiples", "attaquemultiple", "angriffsserie", "mehrfachangriff",
  "attacchimultipli", "ataquemultiplo", "multiataques",
];

const alphaKey = (s) => fold(s).replace(/[^a-z]/g, "");

function detectMultiattack(items, attacks) {
  if (!attacks.length) return null;
  let approximate = null; // se guarda por si no aparece una rutina exacta

  for (const it of items) {
    if (it.type !== "feat") continue;
    if (it.system?.type?.value !== "monster") continue;

    // Un multiataque no tiene mecánica propia: solo ordena las que ya existen.
    const acts = Object.values(it.system?.activities ?? {});
    const hasOwnMechanics = acts.some(
      (a) => a?.type === "attack" || a?.save || (a?.damage?.parts ?? []).length
    );
    if (hasOwnMechanics) continue;

    const hinted =
      MULTIATTACK_HINTS.some((h) => alphaKey(it.name).includes(h)) ||
      MULTIATTACK_HINTS.some((h) => alphaKey(it.system?.identifier ?? "").includes(h));

    const text = fold(stripHtml(it.system?.description?.value));
    const parts = [];
    for (const at of attacks) {
      if (at.name.length < 4) continue;
      const idx = text.indexOf(fold(at.name));
      if (idx < 0) continue;
      parts.push({ name: at.name, count: countBefore(text, idx), attack: at });
    }

    // NIVEL 1 — rutina legible: la descripción nombra dos o más de sus ataques.
    if (parts.length >= 2) {
      return {
        name: it.name,
        approximate: false,
        parts: parts.map(({ name, count }) => ({ name, count })),
        available: attacks.map((a) => ({ name: a.name, toHit: a.toHit, avgDamage: a.avgDamage })),
        avgDamage:
          Math.round(parts.reduce((a, p) => a + p.count * p.attack.avgDamage, 0) * 10) / 10,
        toHit: Math.max(...parts.map((p) => p.attack.toHit ?? 0)),
      };
    }

    // NIVEL 2 — el rasgo existe pero la rutina no se puede leer (nombres y
    // descripción en idiomas distintos, o redacción que no los menciona).
    // Se marca igual y se ofrecen las armas para que el DM arme la ronda.
    if (!approximate && (hinted || (parts.length === 1 && attacks.length >= 2))) {
      approximate = {
        name: it.name,
        approximate: true,
        parts: [],
        available: attacks.map((a) => ({ name: a.name, toHit: a.toHit, avgDamage: a.avgDamage })),
        // Sin rutina no inventamos una suma: usamos el mejor golpe suelto como
        // piso honesto, y el informe avisa que la ronda real pega más.
        avgDamage: Math.max(...attacks.map((a) => a.avgDamage ?? 0)),
        toHit: Math.max(...attacks.map((a) => a.toHit ?? 0)),
      };
    }
  }

  // NIVEL 3 — nada detectado: se devuelve null y el plan usa ataques sueltos.
  return approximate;
}

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

  const moves = [];
  const saveEffects = [];
  const attacks = [];
  let ranged = false;

  for (const it of actor.items ?? []) {
    // Un ítem puede tener varias activities que son PARTES DE LA MISMA acción
    // (Life Drain: tirada de ataque + salvación de CON). Tratarlas como movidas
    // rivales hace que compitan entre sí y que el plan describa media acción.
    // Se fusionan en una sola movida por ítem.
    let merged = null;

    for (const act of Object.values(it.system?.activities ?? {})) {
      // El alcance puede venir de un efecto de salvación (rayos oculares),
      // no solo de un ataque: hay que mirarlo en TODA activity.
      if (act?.attack?.type?.value === "ranged" || isRangedRange(act?.range)) {
        ranged = true;
      }

      const activation = readActivation(it, act);
      if (activation === "passive") continue; // rasgo, no movida

      const parts = damageParts(it, act);
      let avgDamage = parts.reduce((a, p) => a + (avgOfPart(p) ?? 0), 0);
      const sv = readSave(act, fallbackDC);
      const isAttack = act?.type === "attack";
      const ab = isAttack ? attackAbility(it, act, sys) : null;

      // El modificador solo entra en el daño base del arma, no en las partes
      // extra (venenos, daño mágico adicional), que van sueltas.
      if (isAttack && act?.damage?.includeBase && it.type === "weapon") {
        avgDamage += abilityMod(sys.abilities?.[ab]?.value);
      }
      if (!isAttack && !sv && avgDamage <= 0) continue;

      merged ??= {
        name: it.name,
        kind: null,
        activation,
        avgDamage: 0,
        damageTypes: new Set(),
        toHit: null,
        ability: null,
        dc: null,
        uses: readUses(it, act),
      };

      // Máximo, no suma: las activities suelen describir la misma tirada.
      merged.avgDamage = Math.max(merged.avgDamage, avgDamage);
      for (const p of parts) for (const t of p?.types ?? []) merged.damageTypes.add(t);

      if (isAttack) {
        merged.kind = "attack";
        merged.toHit = act.attack?.flat
          ? num(act.attack?.bonus)
          : abilityMod(sys.abilities?.[ab]?.value) + prof + num(act.attack?.bonus);
      }
      if (sv) {
        merged.ability = sv.ability;
        merged.dc = sv.dc;
        merged.kind ??= "save";
      }
      if (!merged.kind && avgDamage > 0) merged.kind = "damage";
    }

    if (!merged?.kind) continue;
    merged.avgDamage = Math.round(merged.avgDamage * 10) / 10;
    merged.damageTypes = [...merged.damageTypes];
    moves.push(merged);

    if (merged.ability) {
      saveEffects.push({
        name: it.name,
        activation: merged.activation,
        ability: merged.ability,
        dc: merged.dc,
      });
    }
    if (merged.kind === "attack" && merged.avgDamage > 0) {
      attacks.push({
        name: it.name,
        activation: merged.activation,
        toHit: merged.toHit,
        avgDamage: merged.avgDamage,
      });
    }
  }

  // El multiataque es lo que el bicho hace CADA ronda; se agrega como movida
  // sintética para que el planificador lo prefiera sobre un ataque suelto, y se
  // marca para que no lo penalice la regla de repetición.
  const multiattack = detectMultiattack(actor.items ?? [], attacks);
  if (multiattack) {
    moves.push({
      name: multiattack.name,
      kind: "attack",
      activation: "action",
      avgDamage: multiattack.avgDamage,
      damageTypes: [],
      toHit: multiattack.toHit,
      ability: null,
      dc: null,
      uses: null,
      routine: multiattack.parts,
      available: multiattack.available,
      approximate: multiattack.approximate,
      alwaysAvailable: true,
    });
  }

  return {
    name: actor.name,
    cr,
    count,
    resist: sys.traits?.dr?.value ?? [],
    immune: sys.traits?.di?.value ?? [],
    vulnerable: sys.traits?.dv?.value ?? [],
    conditionImmune: sys.traits?.ci?.value ?? [],
    multiattack,
    moves,
    saveEffects,
    // Con rutina legible, la lectura defensiva mide la ronda completa. Sin
    // ella no se antepone nada: el número seguiría siendo un golpe suelto y
    // fingir lo contrario sería peor que quedarse corto avisando.
    attacks:
      multiattack && !multiattack.approximate
        ? [
            {
              name: multiattack.name,
              activation: "action",
              toHit: multiattack.toHit,
              avgDamage: multiattack.avgDamage,
            },
            ...attacks,
          ]
        : attacks,
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
