// GG Encounter Lens — planificador táctico (determinista, sin IA).
// -----------------------------------------------------------------------------
// El informe dice QUÉ está mal. Esto responde QUÉ HACER con eso: un guion de N
// rondas donde cada monstruo usa la movida que más castiga a ESTE grupo, más
// contingencias para cuando el combate se tuerce.
//
// Determinista a propósito: testeable, reproducible, sin clave de API y sin red.
// Igual que el motor de análisis, emite notas estructuradas {key, data}.
// -----------------------------------------------------------------------------

import { pFail, pHit, pct } from "./analyze.mjs";

// Valor táctico de dejar a un PJ fuera de combate una ronda, expresado en
// "puntos de daño equivalente". Aproxima lo que un PJ de nivel medio aporta por
// ronda; sirve para comparar control contra daño en la misma escala.
// Sacar a un PJ de la ronda vale bastante mas que su output: pierde el turno,
// suele conceder ventaja a los atacantes y arrastra al grupo a gastar acciones
// en liberarlo. Con 22 el control perdia siempre contra el dano bruto, que es
// justo el error que vuelve aburridos a los monstruos interesantes.
const CONTROL_VALUE = 34;

// Sesgo por fase del combate: abrir bloqueando, cerrar rematando. Es lo que
// hace que el guion se sienta disenado y no una lista ordenada por dano.
function phaseBias(isControl, round) {
  if (round === 1) return isControl ? 1.35 : 1.0;
  if (round >= 3) return isControl ? 0.9 : 1.15;
  return 1;
}

// Los nombres de acciones de guarida suelen ser parrafos enteros del stat block.
const trim = (s, max = 46) =>
  s && s.length > max ? `${s.slice(0, max - 1).trimEnd()}...` : s;

/** Etiqueta del monstruo, con cantidad cuando vienen en grupo. */
const label = (m) => ((m.count ?? 1) > 1 ? `${m.name} x${m.count}` : m.name);

// Cuántas veces puede repetirse la misma movida antes de preferir otra.
const REPEAT_PENALTY = 0.55;

const entry = (key, data, extra = {}) => ({ key, data, ...extra });

// --- elección de blanco ------------------------------------------------------

/** Para un ataque: a quién conviene pegarle (el que cae más rápido). */
function bestAttackTarget(move, party) {
  let best = null;
  for (const pc of party.members) {
    const hit = pHit(move.toHit ?? 0, pc.ac);
    const expected = hit * (move.avgDamage || 0);
    if (expected <= 0) continue;
    // Prioriza velocidad de derribo, no daño bruto: bajar a uno vale más que
    // repartir. Es lo que haría un monstruo con instinto de depredador.
    const speed = expected / Math.max(1, pc.hpMax);
    if (!best || speed > best.speed) {
      best = { pc, hit, expected, speed, hits: Math.max(1, Math.ceil(pc.hpMax / expected)) };
    }
  }
  return best;
}

/** Para una salvación: quién es más probable que falle. */
function bestSaveTarget(move, party) {
  const rows = party.members.map((pc) => ({
    pc,
    p: pFail(pc.saves?.[move.ability] ?? 0, move.dc ?? 10),
  }));
  rows.sort((a, b) => b.p - a.p);
  const avg = rows.reduce((a, r) => a + r.p, 0) / (rows.length || 1);
  return { worst: rows[0], avg, rows };
}

// --- puntuación --------------------------------------------------------------

/** Impacto esperado de una movida contra este grupo, en daño equivalente. */
function scoreMove(move, party) {
  if (move.kind === "attack") {
    const t = bestAttackTarget(move, party);
    if (!t) return null;
    return { score: t.expected, kind: "attack", target: t.pc, info: t };
  }

  if (move.kind === "save") {
    const t = bestSaveTarget(move, party);
    const score =
      move.avgDamage > 0
        ? // Con daño: fallar lo cobra entero, salvar suele cobrar la mitad.
          t.avg * move.avgDamage + (1 - t.avg) * (move.avgDamage / 2)
        : // Control puro: vale lo que vale sacar a alguien de la ronda.
          t.avg * CONTROL_VALUE;
    return { score, kind: "save", target: t.worst.pc, info: t };
  }

  // Daño automático, sin tirada.
  return move.avgDamage > 0
    ? { score: move.avgDamage, kind: "damage", target: null, info: null }
    : null;
}

// --- construcción del guion --------------------------------------------------

function describe(monster, move, scored, party) {
  const common = { monster: label(monster), move: trim(move.name) };

  if (scored.kind === "attack") {
    const i = scored.info;
    const data = {
      ...common,
      target: i.pc.name,
      hitPct: pct(i.hit),
      dmg: Math.round(i.expected),
      hits: i.hits,
    };
    // Un ataque puede arrastrar una salvación (Life Drain: golpe + CON o se
    // reduce el máximo de PV). Decir solo la mitad confunde en la mesa.
    if (move.approximate && move.available?.length) {
      return entry(
        "GGEL.plan.multiattackRaw",
        {
          ...data,
          options: move.available
            .map((a) => `${a.name} (+${a.toHit ?? 0}, ~${Math.round(a.avgDamage ?? 0)})`)
            .join(" · "),
        },
        { activation: move.activation }
      );
    }
    if (move.routine?.length) {
      return entry(
        "GGEL.plan.multiattack",
        {
          ...data,
          routine: move.routine.map((r) => `${r.count}x ${r.name}`).join(" + "),
        },
        { activation: move.activation }
      );
    }
    if (move.ability && move.dc) {
      const t = bestSaveTarget(move, party);
      return entry(
        "GGEL.plan.attackSave",
        {
          ...data,
          ability: move.ability.toUpperCase(),
          dc: move.dc,
          failPct: pct(t.worst.p),
        },
        { activation: move.activation }
      );
    }
    return entry("GGEL.plan.attack", data, { activation: move.activation });
  }

  if (scored.kind === "save") {
    const i = scored.info;
    return entry(
      move.avgDamage > 0 ? "GGEL.plan.saveDamage" : "GGEL.plan.saveControl",
      {
        ...common,
        ability: (move.ability ?? "").toUpperCase(),
        dc: move.dc,
        target: i.worst.pc.name,
        failPct: pct(i.worst.p),
        avg: pct(i.avg),
        dmg: Math.round(move.avgDamage),
      },
      { activation: move.activation }
    );
  }

  return entry(
    "GGEL.plan.auto",
    { ...common, dmg: Math.round(move.avgDamage) },
    { activation: move.activation }
  );
}

/**
 * Arma el plan.
 * @param {{members:Array}} party
 * @param {{monsters:Array}} encounter
 * @param {{rounds?:number}} options
 */
export function planTurns(party, encounter, { rounds = 3 } = {}) {
  if (!party?.members?.length || !encounter?.monsters?.length) {
    return { rounds: [], contingencies: [], empty: true };
  }

  // Estado por monstruo: movidas disponibles y cuántas veces se usó cada una.
  const actors = encounter.monsters.map((m) => ({
    monster: m,
    used: new Map(),
    // Solo lo que se puede hacer en el propio turno; legendarias y guarida van
    // por canales separados porque ocurren fuera de él.
    actions: (m.moves ?? []).filter((mv) =>
      ["action", "bonus", "special"].includes(mv.activation)
    ),
    legendary: (m.moves ?? []).filter((mv) => mv.activation === "legendary"),
    lair: (m.moves ?? []).filter((mv) => mv.activation === "lair"),
  }));

  const plan = [];
  for (let r = 1; r <= rounds; r++) {
    const entries = [];

    for (const a of actors) {
      // Si el bicho multiataca, sus golpes sueltos no son opciones reales: la
      // ronda es la rutina completa. Ofrecer "una garra" seria un guion falso.
      const multi = a.actions.find((m) => m.routine?.length || m.approximate);

      let best = null;
      for (const move of a.actions) {
        if (multi && move !== multi && move.kind === "attack") continue;
        const scored = scoreMove(move, party);
        if (!scored) continue;

        const timesUsed = a.used.get(move.name) ?? 0;
        // Los recursos limitados se gastan, no se repiten hasta el infinito.
        if (move.uses?.type === "limited" && timesUsed >= move.uses.max) continue;
        // Una recarga no vuelve al turno siguiente: dejamos pasar una ronda.
        if (move.uses?.type === "recharge" && timesUsed > 0 && r - (a.lastUsed?.get?.(move.name) ?? 0) < 2)
          continue;

        // Penalizamos la repetición para que el guion tenga variedad, salvo que
        // no haya alternativa real, y sesgamos según la fase del combate.
        const isControl = scored.kind === "save" && !(move.avgDamage > 0);
        // El multiataque es lo que el bicho hace CADA ronda: penalizarlo por
        // repetirse produciria un guion falso donde el dragon deja de morder.
        const repeat = move.alwaysAvailable ? 1 : Math.pow(REPEAT_PENALTY, timesUsed);
        const adjusted = scored.score * repeat * phaseBias(isControl, r);
        if (!best || adjusted > best.adjusted) best = { move, scored, adjusted };
      }

      if (!best) continue;
      a.used.set(best.move.name, (a.used.get(best.move.name) ?? 0) + 1);
      a.lastUsed ??= new Map();
      a.lastUsed.set(best.move.name, r);

      entries.push(describe(a.monster, best.move, best.scored, party));

      // Legendarias: la de mayor impacto, una vez por ronda.
      const leg = a.legendary
        .map((mv) => ({ mv, s: scoreMove(mv, party) }))
        .filter((x) => x.s)
        .sort((x, y) => y.s.score - x.s.score)[0];
      if (leg) {
        entries.push(
          entry(
            "GGEL.plan.legendary",
            { monster: label(a.monster), move: trim(leg.mv.name) },
            { activation: "legendary" }
          )
        );
      }

      // Guarida: solo en la primera ronda, en iniciativa 20.
      if (r === 1 && a.lair.length) {
        entries.push(
          entry(
            "GGEL.plan.lair",
            { monster: label(a.monster), move: trim(a.lair[0].name) },
            { activation: "lair" }
          )
        );
      }
    }

    if (entries.length) plan.push({ n: r, entries });
  }

  return { rounds: plan, contingencies: contingencies(party, encounter, actors) };
}

// --- contingencias -----------------------------------------------------------

function contingencies(party, encounter, actors) {
  const out = [];

  // 1. Monstruo malherido: guardar el recurso fuerte para ese momento.
  for (const a of actors) {
    const reserve = a.actions
      .filter((mv) => mv.uses && !(a.used.get(mv.name) ?? 0))
      .sort((x, y) => (y.avgDamage ?? 0) - (x.avgDamage ?? 0))[0];
    if (reserve) {
      out.push(
        entry("GGEL.plan.cont.reserve", {
          monster: label(a.monster),
          move: trim(reserve.name),
        })
      );
      break; // una sola sugerencia de reserva: más es ruido
    }
  }

  // 2. Voladores: cuando cobran daño, se van al aire y castigan desde arriba.
  const flyer = encounter.monsters.find((m) => m.fly);
  const anyRanged = party.members.some((p) => p.hasRanged);
  if (flyer) {
    out.push(
      entry(anyRanged ? "GGEL.plan.cont.flyRanged" : "GGEL.plan.cont.flyNoRanged", {
        monster: label(flyer),
      })
    );
  }

  // 3. Si cae un PJ, a quién pasa el foco.
  const order = [...party.members].sort(
    (a, b) => a.ac - b.ac || a.hpMax - b.hpMax
  );
  if (order.length >= 2) {
    out.push(
      entry("GGEL.plan.cont.pcDown", {
        first: order[0].name,
        next: order[1].name,
      })
    );
  }

  // 4. Insistir con la salvación que el grupo falla más.
  const tally = new Map();
  for (const m of encounter.monsters)
    for (const eff of m.saveEffects ?? []) {
      const g = tally.get(eff.ability) ?? { dc: 0, n: 0 };
      g.dc = Math.max(g.dc, eff.dc);
      g.n += 1;
      tally.set(eff.ability, g);
    }
  let worst = null;
  for (const [ability, g] of tally) {
    const avg =
      party.members.reduce((s, pc) => s + pFail(pc.saves?.[ability] ?? 0, g.dc), 0) /
      party.members.length;
    if (!worst || avg > worst.avg) worst = { ability, avg };
  }
  if (worst && worst.avg >= 0.5) {
    out.push(
      entry("GGEL.plan.cont.softSpot", {
        ability: worst.ability.toUpperCase(),
        avg: pct(worst.avg),
      })
    );
  }

  return out;
}
