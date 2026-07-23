// GG Encounter Lens — puente Foundry ⇄ extractor.
// -----------------------------------------------------------------------------
// Único archivo que toca la API de documentos de Foundry. Su trabajo es dar al
// extractor SIEMPRE la misma forma de datos, venga de donde venga.
//
// Truco central: actor.toObject() devuelve exactamente la forma del JSON
// exportado (items como array, activities como objeto plano) — o sea, la forma
// contra la que validamos el extractor con probes reales. Encima de esa base
// inyectamos los valores DERIVADOS que solo existen en runtime (CA, PV máx,
// competencia, nivel, totales de salvación). Resultado: un solo camino de
// código, sin estimaciones, cuando corre dentro de Foundry.
// -----------------------------------------------------------------------------

/** Actor vivo de Foundry → objeto con forma de probe + valores derivados. */
export function actorToProbe(actor) {
  const src = actor.toObject();
  const live = actor.system ?? {};
  const sys = src.system ?? (src.system = {});

  sys.attributes ??= {};
  sys.details ??= {};
  sys.abilities ??= {};

  // CA y PV máximos: en runtime están resueltos; en el JSON crudo son null.
  if (live.attributes?.ac?.value != null) {
    sys.attributes.ac = { ...sys.attributes.ac, value: live.attributes.ac.value };
  }
  if (live.attributes?.hp?.max != null) {
    sys.attributes.hp = { ...sys.attributes.hp, max: live.attributes.hp.max };
  }
  if (live.attributes?.prof != null) sys.attributes.prof = live.attributes.prof;
  if (live.attributes?.spellcasting) {
    sys.attributes.spellcasting = live.attributes.spellcasting;
  }
  if (live.attributes?.movement) sys.attributes.movement = live.attributes.movement;

  // Nivel total del PJ (derivado de los ítems de clase por el sistema).
  if (live.details?.level != null) sys.details.level = live.details.level;
  if (live.details?.cr != null) sys.details.cr = live.details.cr;

  // Totales de salvación ya calculados (incluye competencia, objetos, efectos).
  for (const [key, ab] of Object.entries(live.abilities ?? {})) {
    if (!sys.abilities[key]) continue;
    if (ab?.save?.value != null) {
      sys.abilities[key].save = { ...sys.abilities[key].save, value: ab.save.value };
    }
  }

  return { name: actor.name, type: actor.type, system: sys, items: src.items ?? [] };
}

/** Todos los PJ del mundo que el usuario puede ver, ordenados por nombre. */
export function listCharacters() {
  return game.actors
    .filter((a) => a.type === "character" && a.testUserPermission(game.user, "OBSERVER"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Agrupa actores repetidos en { actorId, name, count }. */
function tally(actors) {
  const map = new Map();
  for (const a of actors) {
    if (!a) continue;
    const e = map.get(a.id) ?? { actorId: a.id, name: a.name, count: 0 };
    e.count += 1;
    map.set(a.id, e);
  }
  return [...map.values()];
}

/** PNJs de los tokens seleccionados en el lienzo. */
export function encounterFromCanvas() {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return { error: "GGEL.warn.noTokens" };
  const npcs = tally(tokens.map((t) => t.actor).filter((a) => a?.type === "npc"));
  if (!npcs.length) return { error: "GGEL.warn.noNpcTokens" };
  return { monsters: npcs };
}

/** PNJs presentes en el rastreador de combate. */
export function encounterFromCombat() {
  const combat = game.combat;
  if (!combat) return { error: "GGEL.warn.noCombat" };
  const npcs = tally(
    combat.combatants.map((c) => c.actor).filter((a) => a?.type === "npc")
  );
  if (!npcs.length) return { error: "GGEL.warn.noCombatNpcs" };
  return { monsters: npcs };
}
