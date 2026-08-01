// GG Encounter Lens — punto de entrada del módulo.
// -----------------------------------------------------------------------------
// Registra ajustes, atajo de teclado y las DOS vías de entrada elegidas:
//   • botón en los controles de escena (analiza los tokens seleccionados)
//   • botón en el rastreador de combate (analiza el combate en curso)
//
// Integración con la suite (gg-wp): OPCIONAL, por feature-detection.
//   - Si gg-wp está activo, el botón vive en la sección GGWP · Crónicas Bárdicas
//     y el módulo se registra como miembro de la suite.
//   - Si no está, el botón cae a Token Controls, como siempre. Cero dependencia.
// -----------------------------------------------------------------------------

import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { LensApp } from "./lens-app.mjs";
import { extractPC, extractNPC } from "./extract.mjs";
import { actorToProbe } from "./bridge.mjs";
import { analyze } from "./analyze.mjs";
import { planTurns } from "./tactics.mjs";
import { localizeReport, localizePlan, renderText, t } from "./i18n.mjs";

/* ── Suite Crónicas Bárdicas (gg-wp) ─────────────────────────────────────────
   API sincrónica si el módulo está activo; null si no. Se consulta en cada
   render de los controles porque getSceneControlButtons puede correr antes
   de que gg-wp emita su hook ready. */
function ggwpApi() {
  const m = game.modules.get("gg-wp");
  return (m?.active && m.api) ? m.api : null;
}

Hooks.once("gg-wp.ready", (api) => {
  // Membresía explícita en la suite (el diálogo "Acerca de" lista esto).
  api.registerModule(MODULE_ID);
  // El botón de la sección GGWP. gg-wp le garantiza onChange y el guard de
  // activación (no se dispara al entrar a la sección, solo con clic real).
  api.registerTool({
    name: "gg-encounter-lens",
    title: t("GGEL.tool"),
    icon: "fa-solid fa-eye",
    order: 20,
    button: true,
    onChange: () => LensApp.open()
  });
});

Hooks.once("init", () => {
  // Selección de grupo: por cliente y oculta (se maneja desde el panel).
  game.settings.register(MODULE_ID, SETTINGS.PARTY, {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  // Encuentros guardados: alcance de mundo, porque se preparan un dia y se
  // juegan otro, y un co-DM tiene que poder abrirlos.
  game.settings.register(MODULE_ID, SETTINGS.ENCOUNTERS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  game.keybindings.register(MODULE_ID, "open", {
    name: "GGEL.title",
    editable: [{ key: "KeyL", modifiers: ["Alt"] }],
    restricted: true, // solo DM
    onDown: () => {
      LensApp.open();
      return true;
    },
  });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = {
    /** Abre el panel. `{ fromCombat: true }` precarga el combate en curso. */
    open: (opts) => LensApp.open(opts),

    /**
     * Analiza sin abrir la interfaz. Útil para macros.
     * @param {Actor[]} party     actores de tipo `character`
     * @param {Actor[]|Array<{actor:Actor,count:number}>} monsters
     * @param {{rounds?:number, localize?:boolean}} options
     */
    analyze(party = [], monsters = [], { rounds = 3, localize = true } = {}) {
      const members = party.map((a) => extractPC(actorToProbe(a)));
      const foes = monsters.map((m) =>
        m?.actor
          ? extractNPC(actorToProbe(m.actor), m.count ?? 1)
          : extractNPC(actorToProbe(m), 1)
      );
      const p = { members };
      const e = { monsters: foes };
      const report = analyze(p, e);
      const plan = planTurns(p, e, { rounds });
      return localize
        ? { report: localizeReport(report), plan: localizePlan(plan), raw: { report, plan } }
        : { report, plan };
    },

    /** Informe + plan como texto plano, listo para pegar en un journal. */
    toText(party = [], monsters = [], options = {}) {
      const { raw } = game.modules.get(MODULE_ID).api.analyze(party, monsters, options);
      return renderText(raw.report, raw.plan);
    },

    LensApp,
  };
});

// --- Botón en los controles de escena ----------------------------------------
// Con gg-wp activo, el botón vive en la sección GGWP (lo registró el hook
// gg-wp.ready de arriba) y acá NO se duplica en Token Controls.
// Sin gg-wp, cae a Token Controls exactamente como antes.
// v13 entrega `controls` como objeto indexado; v12 lo entregaba como array.
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  if (ggwpApi()) return; // la sección GGWP ya tiene el botón; no duplicar

  const tool = {
    name: "gg-encounter-lens",
    title: "GGEL.tool",
    icon: "fa-solid fa-eye",
    button: true,
    visible: true,
    order: 99,
    onChange: () => LensApp.open(),
    onClick: () => LensApp.open(), // compatibilidad v12
  };

  if (Array.isArray(controls)) {
    const tokens = controls.find((c) => c.name === "token" || c.name === "tokens");
    if (tokens?.tools) tokens.tools.push(tool);
    return;
  }

  const tokens = controls.tokens ?? controls.token;
  if (!tokens) return;
  if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
  else if (tokens.tools) tokens.tools[tool.name] = tool;
});

// --- Botón en el rastreador de combate ---------------------------------------
// En v13 el CombatTracker es ApplicationV2 y el hook entrega un HTMLElement;
// en v12 entregaba jQuery. Normalizamos antes de tocar el DOM.
// Esta vía de entrada NO depende de gg-wp: analizar el combate en curso desde
// el tracker es útil esté la suite o no.
Hooks.on("renderCombatTracker", (app, html) => {
  if (!game.user?.isGM) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  if (root.querySelector(".ggel-tracker-button")) return; // no duplicar

  const header =
    root.querySelector("#combat-round") ??
    root.querySelector(".combat-tracker-header") ??
    root.querySelector("header") ??
    root.firstElementChild;
  if (!header) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ggel-tracker-button";
  btn.innerHTML = `<i class="fa-solid fa-eye"></i> ${t("GGEL.tool")}`;
  btn.addEventListener("click", () => LensApp.open({ fromCombat: true }));
  header.append(btn);
});
