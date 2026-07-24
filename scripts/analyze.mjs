// GG Encounter Lens — motor de análisis (engine puro, agnóstico de Foundry)
// -----------------------------------------------------------------------------
// Arquitectura (misma filosofía que Sheet Export):
//   extracción (JSON del sistema) → IR normalizada → ANÁLISIS → presentación.
//
// Este archivo NO produce texto final: emite NOTAS ESTRUCTURADAS
//   { sev, key, data }
// donde `key` es una clave i18n y `data` los parámetros. La localización ocurre
// en la capa de presentación (i18n.mjs). Así el mismo motor sirve en español,
// inglés o cualquier idioma sin tocar la lógica.
// -----------------------------------------------------------------------------

export const SEV = {
  THREAT: "threat", // 🔴 los va a lastimar por esta razón
  FRICTION: "friction", // 🟡 fricción, no letal pero incómodo
  ADVANTAGE: "advantage", // 🟢 el grupo tiene ventaja acá
  INFO: "info", // ℹ️ contexto, sin veredicto
};

export const SEV_ICON = {
  threat: "🔴",
  friction: "🟡",
  advantage: "🟢",
  info: "ℹ️",
};

// --- Probabilidades d20 (crudas, sin crítico/pifia; alcanza para señal) ------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Falla un save si d20 + mod < dc. Devuelve prob. de FALLO [0..1].
export const pFail = (mod, dc) => clamp01((dc - mod - 1) / 20);
// Acierta un ataque si d20 + toHit >= ac. Devuelve prob. de ACIERTO [0..1].
export const pHit = (toHit, ac) => clamp01((21 - (ac - toHit)) / 20);
export const pct = (x) => `${Math.round(x * 100)}%`;

const note = (sev, key, data) => ({ sev, key, data });
const list = (xs) => xs.join(", ");

// =============================================================================
//  CHECK 1 — Matchup de daño (tipos que reparte el grupo vs res/inm/vuln)
// =============================================================================
function checkDamageMatchup(party, enc) {
  const out = [];
  for (const m of enc.monsters) {
    const neutralized = [];
    const partial = []; // parte de su daño rebota — el hueco que se perdía
    const resisted = [];
    const vuln = [];
    const blocked = new Set();
    let severePartial = false;

    for (const pc of party.members) {
      const types = pc.damageTypes ?? [];
      if (!types.length) continue;
      const immuneHit = types.filter((t) => m.immune.includes(t));
      const resistHit = types.filter((t) => m.resist.includes(t));

      if (immuneHit.length && immuneHit.length === types.length) {
        neutralized.push(pc.name);
        immuneHit.forEach((t) => blocked.add(t));
      } else if (immuneHit.length) {
        // Perder UNA vía de daño clave (el mago de fuego contra un dragón rojo)
        // es información táctica de primer orden, aunque le queden otras.
        partial.push(pc.name);
        immuneHit.forEach((t) => blocked.add(t));
        if (immuneHit.length / types.length >= 0.4) severePartial = true;
      } else if (resistHit.length) {
        resisted.push(pc.name);
      }
      if (types.some((t) => m.vulnerable.includes(t))) vuln.push(pc.name);
    }

    if (neutralized.length) {
      out.push(
        note(SEV.THREAT, "GGEL.note.dmgNeutralized", {
          monster: m.name,
          pcs: list(neutralized),
          immune: m.immune.join(" / "),
        })
      );
    }

    if (partial.length) {
      out.push(
        note(
          severePartial ? SEV.THREAT : SEV.FRICTION,
          "GGEL.note.dmgPartialImmune",
          {
            monster: m.name,
            pcs: list(partial),
            blocked: [...blocked].join(" / "),
          }
        )
      );
    }

    if (resisted.length >= Math.ceil(party.members.length / 2)) {
      out.push(
        note(SEV.FRICTION, "GGEL.note.dmgResistedHalf", {
          monster: m.name,
          pcs: list(resisted),
          resist: m.resist.join(" / "),
        })
      );
    } else if (resisted.length) {
      out.push(
        note(SEV.INFO, "GGEL.note.dmgResistedSome", {
          monster: m.name,
          pcs: list(resisted),
          resist: m.resist.join(" / "),
        })
      );
    }

    if (vuln.length) {
      out.push(
        note(SEV.ADVANTAGE, "GGEL.note.dmgVulnerable", {
          monster: m.name,
          pcs: list(vuln),
          vulnerable: m.vulnerable.join(" / "),
        })
      );
    }
  }
  return out;
}

// =============================================================================
//  CHECK 2 — Matchup de salvaciones
// -----------------------------------------------------------------------------
//  Un Beholder tiene 10+ efectos con salvación. Emitir una nota por cada uno es
//  RUIDO: en la mesa "los rayos" son UNA amenaza. Consolidamos por habilidad
//  (peor CD) y contamos cuántos efectos la apuntan. Hallazgo del probe real.
// =============================================================================
function checkSaveMatchup(party, enc) {
  const out = [];
  for (const m of enc.monsters) {
    const byAbility = new Map();
    for (const eff of m.saveEffects ?? []) {
      const g = byAbility.get(eff.ability) ?? { dc: 0, names: [] };
      g.dc = Math.max(g.dc, eff.dc);
      if (!g.names.includes(eff.name)) g.names.push(eff.name);
      byAbility.set(eff.ability, g);
    }

    for (const [ability, g] of byAbility) {
      const rows = party.members.map((pc) => {
        const mod = pc.saves?.[ability] ?? 0;
        return { name: pc.name, mod, p: pFail(mod, g.dc) };
      });
      const failing = rows.filter((r) => r.p >= 0.55);
      if (!failing.length) continue;

      const avg = rows.reduce((a, r) => a + r.p, 0) / rows.length;
      const sev =
        failing.length >= Math.ceil(party.members.length / 2)
          ? SEV.THREAT
          : SEV.FRICTION;
      const common = {
        monster: m.name,
        ability: ability.toUpperCase(),
        dc: g.dc,
        // Transparencia: el DM tiene que poder auditar por qué se marcó a
        // alguien. Sin el modificador y el %, la herramienta pide fe ciega.
        failing: list(
          failing.map((r) => `${r.name} ${r.mod >= 0 ? "+" : ""}${r.mod} → ${pct(r.p)}`)
        ),
        avg: pct(avg),
      };

      out.push(
        g.names.length > 1
          ? note(sev, "GGEL.note.saveMulti", {
              ...common,
              count: g.names.length,
              examples: g.names.slice(0, 3).join("; "),
            })
          : note(sev, "GGEL.note.saveSingle", { ...common, effect: g.names[0] })
      );
    }
  }
  return out;
}

// =============================================================================
//  CHECK 3 — Punto débil transversal
// -----------------------------------------------------------------------------
//  Si DOS monstruos distintos apuntan a la misma salvación, ya no es una
//  amenaza puntual: es EL agujero del grupo en este encuentro. Merece una nota
//  propia, porque la conclusión táctica es distinta (rotar defensas, no esquivar
//  un efecto concreto).
// =============================================================================
function checkSoftSpot(party, enc) {
  if (party.members.length < 2) return [];
  const byAbility = new Map();

  for (const m of enc.monsters) {
    for (const eff of m.saveEffects ?? []) {
      const g = byAbility.get(eff.ability) ?? { monsters: new Set(), count: 0, dc: 0 };
      g.monsters.add(m.name);
      g.count += 1;
      g.dc = Math.max(g.dc, eff.dc);
      byAbility.set(eff.ability, g);
    }
  }

  let worst = null;
  for (const [ability, g] of byAbility) {
    if (g.monsters.size < 2) continue;
    const avg =
      party.members.reduce((a, pc) => a + pFail(pc.saves?.[ability] ?? 0, g.dc), 0) /
      party.members.length;
    if (avg < 0.5) continue;
    if (!worst || avg > worst.avg) worst = { ability, g, avg };
  }
  if (!worst) return [];

  return [
    note(SEV.THREAT, "GGEL.note.softSpot", {
      ability: worst.ability.toUpperCase(),
      monsters: worst.g.monsters.size,
      count: worst.g.count,
      avg: pct(worst.avg),
    }),
  ];
}

// =============================================================================
//  CHECK 4 — Alcance / movilidad
// =============================================================================
function checkReach(party, enc) {
  const ranged = party.members.filter((p) => p.hasRanged);
  const melee = party.members.filter((p) => !p.hasRanged);
  const elusive = enc.monsters.filter((m) => m.fly || m.ranged);
  if (!elusive.length) return [];

  const monsters = list(elusive.map((m) => m.name));
  if (!ranged.length) {
    return [note(SEV.THREAT, "GGEL.note.reachNone", { monsters })];
  }
  if (melee.length) {
    return [
      note(SEV.FRICTION, "GGEL.note.reachPartial", {
        monsters,
        melee: list(melee.map((p) => p.name)),
        ranged: list(ranged.map((p) => p.name)),
      }),
    ];
  }
  return [];
}

// =============================================================================
//  CHECK 4 — Economía de acción
// =============================================================================
function checkActionEconomy(party, enc) {
  const enemies = enc.monsters.reduce((a, m) => a + (m.count ?? 1), 0);
  const size = party.members.length;
  if (!size) return [];
  const ratio = enemies / size;
  if (ratio < 1.5) return [];
  return [
    note(ratio >= 2.5 ? SEV.THREAT : SEV.FRICTION, "GGEL.note.economy", {
      enemies,
      party: size,
      ratio: ratio.toFixed(1),
    }),
  ];
}

// =============================================================================
//  CHECK 5 — Lectura defensiva (el PJ más frágil vs el mejor golpe enemigo)
// =============================================================================
function checkDefensive(party, enc) {
  if (!party.members.length) return [];
  const frail = [...party.members].sort(
    (a, b) => a.ac - b.ac || a.hpMax - b.hpMax
  )[0];

  let best = null;
  for (const m of enc.monsters)
    for (const at of m.attacks ?? [])
      if (!best || at.avgDamage > best.at.avgDamage) best = { m, at };
  if (!best) return [];

  const hit = pHit(best.at.toHit, frail.ac);
  const hits = Math.max(1, Math.ceil(frail.hpMax / best.at.avgDamage));
  return [
    note(hits <= 2 && hit >= 0.5 ? SEV.THREAT : SEV.FRICTION, "GGEL.note.defensive", {
      pc: frail.name,
      ac: frail.ac,
      hp: frail.hpMax,
      attack: best.at.name,
      monster: best.m.name,
      toHit: best.at.toHit,
      hitPct: pct(hit),
      dmg: Math.round(best.at.avgDamage),
      hits,
    }),
  ];
}

// =============================================================================
//  Avisos de calidad de datos — honestidad sobre valores estimados
// =============================================================================
function checkDataQuality(party) {
  const est = party.members.filter((p) => p.acEstimated || p.hpEstimated);
  if (!est.length) return [];
  return [
    note(SEV.INFO, "GGEL.note.estimated", {
      pcs: list(est.map((p) => p.name)),
    }),
  ];
}

// =============================================================================
//  Multiataque sin rutina legible — la marca que pidio el DM
// -----------------------------------------------------------------------------
//  Si sabemos que el bicho multiataca pero no pudimos leer la rutina, callarlo
//  seria peor que avisarlo: la lectura defensiva quedaria corta y el DM no
//  sabria por que. Se dice, y se listan las armas para que arme la ronda.
// =============================================================================
function checkMultiattack(party, enc) {
  const out = [];
  for (const m of enc.monsters) {
    const ma = m.multiattack;
    if (!ma?.approximate) continue;
    out.push(
      note(SEV.FRICTION, "GGEL.note.multiattackRaw", {
        monster: m.name,
        feature: ma.name,
        options: (ma.available ?? []).map((a) => a.name).join(" / "),
      })
    );
  }
  return out;
}

// =============================================================================
//  Baseline XP/CR — SOLO contexto, nunca veredicto
// =============================================================================
function baselineNote(party, enc) {
  return note(SEV.INFO, "GGEL.note.baseline", {
    cr: enc.monsters.reduce((a, m) => a + (m.cr ?? 0) * (m.count ?? 1), 0),
    levels: party.members.reduce((a, p) => a + (p.level ?? 0), 0),
  });
}

// =============================================================================
//  API pública
// =============================================================================
export function analyze(party, encounter) {
  const checks = [
    ...checkDamageMatchup(party, encounter),
    ...checkSaveMatchup(party, encounter),
    ...checkSoftSpot(party, encounter),
    ...checkReach(party, encounter),
    ...checkActionEconomy(party, encounter),
    ...checkDefensive(party, encounter),
    ...checkMultiattack(party, encounter),
    ...checkDataQuality(party),
  ];
  const order = { threat: 0, friction: 1, advantage: 2, info: 3 };
  checks.sort((a, b) => order[a.sev] - order[b.sev]);

  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.sev]: (acc[c.sev] ?? 0) + 1 }),
    {}
  );

  return {
    checks,
    baseline: baselineNote(party, encounter),
    counts,
    verdict: counts.threat
      ? "GGEL.verdict.threat"
      : counts.friction
      ? "GGEL.verdict.friction"
      : "GGEL.verdict.clear",
  };
}
