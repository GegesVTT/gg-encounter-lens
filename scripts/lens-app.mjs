// GG Encounter Lens — panel principal (ApplicationV2, Foundry v13).
// -----------------------------------------------------------------------------
// Capa de PRESENTACIÓN: no contiene lógica de análisis ni de extracción.
// Solo junta grupo + encuentro, llama al motor y muestra el informe.
// -----------------------------------------------------------------------------

import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { extractPC, extractNPC } from "./extract.mjs";
import { analyze } from "./analyze.mjs";
import { localizeReport, renderText, t } from "./i18n.mjs";
import {
  actorToProbe,
  listCharacters,
  encounterFromCanvas,
  encounterFromCombat,
} from "./bridge.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LensApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {Set<string>} ids de actores PJ elegidos a mano */
  #party = new Set();
  /** @type {Array<{actorId:string,name:string,count:number}>} */
  #encounter = [];
  /** @type {object|null} informe ya localizado */
  #report = null;

  static DEFAULT_OPTIONS = {
    id: "gg-encounter-lens",
    classes: ["ggse-ui", "ggel-app"],
    tag: "div",
    window: {
      title: "GGEL.title",
      icon: "fa-solid fa-eye",
      resizable: true,
      contentClasses: ["ggel-content"],
    },
    position: { width: 760, height: 800 },
    actions: {
      analyze: LensApp.#onAnalyze,
      fromCanvas: LensApp.#onFromCanvas,
      fromCombat: LensApp.#onFromCombat,
      clearEncounter: LensApp.#onClearEncounter,
      removeMonster: LensApp.#onRemoveMonster,
      selectAll: LensApp.#onSelectAll,
      selectNone: LensApp.#onSelectNone,
      copy: LensApp.#onCopy,
    },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/lens.hbs`, scrollable: [".ggel-scroll"] },
  };

  // --- ciclo de vida --------------------------------------------------------

  constructor(options = {}) {
    super(options);
    // Restaurar la última selección de grupo (por cliente, no por mundo).
    const saved = game.settings.get(MODULE_ID, SETTINGS.PARTY) ?? [];
    this.#party = new Set(saved);
  }

  #saveParty() {
    game.settings.set(MODULE_ID, SETTINGS.PARTY, [...this.#party]);
  }

  async _prepareContext() {
    const characters = listCharacters().map((a) => ({
      id: a.id,
      name: a.name,
      img: a.img,
      level: a.system?.details?.level ?? null,
      selected: this.#party.has(a.id),
    }));

    const monsters = this.#encounter.map((m) => {
      const actor = game.actors.get(m.actorId);
      return {
        ...m,
        img: actor?.img,
        cr: actor?.system?.details?.cr ?? null,
      };
    });

    return {
      characters,
      monsters,
      hasParty: this.#party.size > 0,
      hasEncounter: monsters.length > 0,
      report: this.#report,
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Los checkboxes del grupo no usan data-action porque necesitamos el estado
    // del input, no solo el click.
    for (const box of this.element.querySelectorAll("[data-pc-toggle]")) {
      box.addEventListener("change", (ev) => {
        const id = ev.currentTarget.dataset.pcToggle;
        ev.currentTarget.checked ? this.#party.add(id) : this.#party.delete(id);
        this.#saveParty();
        this.render();
      });
    }
  }

  // --- acciones -------------------------------------------------------------

  static #onSelectAll() {
    for (const a of listCharacters()) this.#party.add(a.id);
    this.#saveParty();
    this.render();
  }

  static #onSelectNone() {
    this.#party.clear();
    this.#saveParty();
    this.render();
  }

  #loadEncounter(result) {
    if (result.error) return ui.notifications.warn(t(result.error));
    this.#encounter = result.monsters;
    this.#report = null;
    this.render();
  }

  static #onFromCanvas() {
    this.#loadEncounter(encounterFromCanvas());
  }

  static #onFromCombat() {
    this.#loadEncounter(encounterFromCombat());
  }

  static #onClearEncounter() {
    this.#encounter = [];
    this.#report = null;
    this.render();
  }

  static #onRemoveMonster(event, target) {
    const id = target.dataset.actorId;
    this.#encounter = this.#encounter.filter((m) => m.actorId !== id);
    this.#report = null;
    this.render();
  }

  static #onAnalyze() {
    if (!this.#party.size) return ui.notifications.warn(t("GGEL.warn.noParty"));
    if (!this.#encounter.length)
      return ui.notifications.warn(t("GGEL.warn.noEncounter"));

    const members = [];
    for (const id of this.#party) {
      const actor = game.actors.get(id);
      if (actor) members.push(extractPC(actorToProbe(actor)));
    }

    const monsters = [];
    for (const entry of this.#encounter) {
      const actor = game.actors.get(entry.actorId);
      if (actor) monsters.push(extractNPC(actorToProbe(actor), entry.count));
    }

    if (!members.length || !monsters.length) {
      return ui.notifications.warn(t("GGEL.warn.noEncounter"));
    }

    const raw = analyze({ members }, { monsters });
    this.#report = localizeReport(raw);
    this.#report.raw = raw;
    this.render();
  }

  static async #onCopy() {
    if (!this.#report?.raw) return;
    await game.clipboard.copyPlainText(renderText(this.#report.raw));
    ui.notifications.info(t("GGEL.ui.copied"));
  }

  // --- helpers de apertura --------------------------------------------------

  /** Instancia única: ui.windows está deprecado para ApplicationV2 en v13. */
  static #instance = null;

  /** Abre el panel (singleton) y opcionalmente precarga el combate en curso. */
  static open({ fromCombat = false } = {}) {
    if (!game.user.isGM) return ui.notifications.warn(t("GGEL.warn.gmOnly"));
    LensApp.#instance ??= new LensApp();
    const app = LensApp.#instance;
    app.render({ force: true });
    if (fromCombat) app.#loadEncounter(encounterFromCombat());
    return app;
  }
}
