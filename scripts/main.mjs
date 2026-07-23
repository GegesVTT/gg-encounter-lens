// GG Encounter Lens — punto de entrada del módulo.
// -----------------------------------------------------------------------------
// Registra ajustes, atajo de teclado y las DOS vías de entrada elegidas:
//   • botón en los controles de escena (analiza los tokens seleccionados)
//   • botón en el rastreador de combate (analiza el combate en curso)
// -----------------------------------------------------------------------------

import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { LensApp } from "./lens-app.mjs";
import { t } from "./i18n.mjs";

Hooks.once("init", () => {
  // Selección de grupo: por cliente y oculta (se maneja desde el panel).
  game.settings.register(MODULE_ID, SETTINGS.PARTY, {
    scope: "client",
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
    open: (opts) => LensApp.open(opts),
    LensApp,
  };
});

// --- Botón en los controles de escena ----------------------------------------
// v13 entrega `controls` como objeto indexado; v12 lo entregaba como array.
// Soportamos ambas formas para no romper si el usuario está en una u otra.
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;

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
