// GG Encounter Lens — capa de localización.
// -----------------------------------------------------------------------------
// Un único punto de traducción que funciona en DOS entornos:
//   • Dentro de Foundry → delega en game.i18n (respeta el idioma del mundo).
//   • En Node (tests)   → usa un diccionario cargado con setDictionary().
// Así el motor se testea fuera de Foundry sin duplicar cadenas.
// -----------------------------------------------------------------------------

import { SEV_ICON } from "./analyze.mjs";

let DICT = {};

/** Carga un diccionario plano { "GGEL.x": "texto {param}" } (solo para Node). */
export function setDictionary(dict) {
  DICT = dict ?? {};
}

/** Traduce una clave interpolando {params}. */
export function t(key, data = {}) {
  const g = globalThis.game;
  if (g?.i18n) {
    return Object.keys(data).length ? g.i18n.format(key, data) : g.i18n.localize(key);
  }
  const raw = DICT[key];
  if (raw === undefined) return key; // clave faltante: visible, no silenciosa
  return raw.replace(/\{(\w+)\}/g, (_, k) => (data[k] ?? `{${k}}`));
}

/** Una nota {sev,key,data} → { sev, icon, head, body }. */
export function localizeNote(n) {
  return {
    sev: n.sev,
    icon: SEV_ICON[n.sev],
    head: t(`${n.key}.head`, n.data),
    body: t(`${n.key}.body`, n.data),
  };
}

/** Informe completo → objeto listo para plantilla o consola. */
export function localizeReport(report) {
  return {
    notes: report.checks.map(localizeNote),
    baseline: localizeNote(report.baseline),
    verdict: t(report.verdict),
    counts: report.counts,
  };
}

/** Plan táctico → estructura lista para plantilla. */
export function localizePlan(plan) {
  const pair = (e) => ({
    head: t(`${e.key}.head`, e.data),
    body: t(`${e.key}.body`, e.data),
  });
  return {
    empty: !!plan.empty,
    rounds: (plan.rounds ?? []).map((r) => ({
      n: r.n,
      label: t("GGEL.plan.round", { n: r.n }),
      entries: r.entries.map((e) => ({ ...pair(e), activation: e.activation ?? "action" })),
    })),
    contingencies: (plan.contingencies ?? []).map(pair),
  };
}

/** Render de texto plano (consola / tests / copiar-pegar). */
export function renderText(report, plan = null) {
  const L = localizeReport(report);
  const line = (n) => `${n.icon}  ${n.head}\n     ${n.body}`;
  const body = L.notes.length
    ? L.notes.map(line).join("\n\n")
    : `${SEV_ICON.advantage}  ${L.verdict}`;
  let out = `${body}\n\n${line(L.baseline)}`;

  if (plan && !plan.empty) {
    const P = localizePlan(plan);
    for (const r of P.rounds) {
      out += `\n\n── ${r.label} ──`;
      for (const e of r.entries) out += `\n  • ${e.head}\n    ${e.body}`;
    }
    if (P.contingencies.length) {
      out += `\n\n── ${t("GGEL.ui.contingencies")} ──`;
      for (const c of P.contingencies) out += `\n  • ${c.head}\n    ${c.body}`;
    }
  }
  return out;
}
