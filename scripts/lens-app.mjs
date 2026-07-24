// GG Encounter Lens — panel principal (ApplicationV2, Foundry v13).
// -----------------------------------------------------------------------------
// Capa de PRESENTACIÓN: no contiene lógica de análisis ni de extracción.
// Junta grupo + encuentro, llama a los motores y muestra informe y plan.
// -----------------------------------------------------------------------------

import { MODULE_ID, SETTINGS, NPC_RESULT_CAP } from "./constants.mjs";
import { extractPC, extractNPC } from "./extract.mjs";
import { analyze } from "./analyze.mjs";
import { planTurns } from "./tactics.mjs";
import { localizeReport, localizePlan, renderText, t } from "./i18n.mjs";
import {
  actorToProbe,
  listCharacters,
  listNPCs,
  listNPCFolders,
  foldAccents,
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
  /** @type {object|null} plan táctico ya localizado */
  #plan = null;
  /** Rondas a planificar. */
  #rounds = 3;
  /** Estado del buscador de PNJs (se filtra en el DOM, sin re-render). */
  #search = "";
  #folder = "";

  static #instance = null;

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
    position: { width: 780, height: 840 },
    actions: {
      analyze: LensApp.#onAnalyze,
      fromCanvas: LensApp.#onFromCanvas,
      fromCombat: LensApp.#onFromCombat,
      clearEncounter: LensApp.#onClearEncounter,
      removeMonster: LensApp.#onRemoveMonster,
      addNpc: LensApp.#onAddNpc,
      bumpCount: LensApp.#onBumpCount,
      selectAll: LensApp.#onSelectAll,
      selectNone: LensApp.#onSelectNone,
      saveEncounter: LensApp.#onSaveEncounter,
      loadEncounter: LensApp.#onLoadEncounter,
      deleteEncounter: LensApp.#onDeleteEncounter,
      copy: LensApp.#onCopy,
    },
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/lens.hbs`,
      scrollable: [".ggel-scroll", ".ggel-npc-list"],
    },
  };

  // --- ciclo de vida --------------------------------------------------------

  constructor(options = {}) {
    super(options);
    this.#party = new Set(game.settings.get(MODULE_ID, SETTINGS.PARTY) ?? []);
  }

  #saveParty() {
    game.settings.set(MODULE_ID, SETTINGS.PARTY, [...this.#party]);
  }

  #savedEncounters() {
    return game.settings.get(MODULE_ID, SETTINGS.ENCOUNTERS) ?? [];
  }

  #invalidate() {
    this.#report = null;
    this.#plan = null;
  }

  async _prepareContext() {
    const characters = listCharacters().map((a) => ({
      id: a.id,
      name: a.name,
      img: a.img,
      level: a.system?.details?.level ?? null,
      selected: this.#party.has(a.id),
    }));

    const chosen = new Set(this.#encounter.map((m) => m.actorId));
    const allNpcs = listNPCs();
    const npcs = allNpcs
      .filter((n) => !chosen.has(n.id))
      .slice(0, NPC_RESULT_CAP)
      .map((n) => ({ ...n, folderKey: n.folderId || "__none__" }));

    const monsters = this.#encounter.map((m) => {
      const actor = game.actors.get(m.actorId);
      return { ...m, img: actor?.img, cr: actor?.system?.details?.cr ?? null };
    });

    return {
      characters,
      npcs,
      folders: listNPCFolders(allNpcs),
      npcTotal: allNpcs.length,
      npcCapped: allNpcs.length > NPC_RESULT_CAP,
      monsters,
      saved: this.#savedEncounters(),
      hasParty: this.#party.size > 0,
      hasEncounter: monsters.length > 0,
      report: this.#report,
      plan: this.#plan,
      rounds: this.#rounds,
      roundOptions: [2, 3, 4, 5].map((n) => ({ n, selected: n === this.#rounds })),
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    for (const box of this.element.querySelectorAll("[data-pc-toggle]")) {
      box.addEventListener("change", (ev) => {
        const id = ev.currentTarget.dataset.pcToggle;
        ev.currentTarget.checked ? this.#party.add(id) : this.#party.delete(id);
        this.#saveParty();
        this.render();
      });
    }

    const roundsSel = this.element.querySelector("[data-rounds]");
    roundsSel?.addEventListener("change", (ev) => {
      this.#rounds = Number(ev.currentTarget.value) || 3;
      this.#report ? this.#recompute() : this.render();
    });

    // Buscador: filtramos el DOM en vez de re-renderizar. Un render por tecla
    // haría perder el foco y el cursor del input en cada pulsación.
    const search = this.element.querySelector("[data-npc-search]");
    if (search) {
      search.value = this.#search;
      search.addEventListener("input", (ev) => {
        this.#search = ev.currentTarget.value;
        this.#applyFilter();
      });
    }

    const folder = this.element.querySelector("[data-npc-folder]");
    if (folder) {
      folder.value = this.#folder;
      folder.addEventListener("change", (ev) => {
        this.#folder = ev.currentTarget.value;
        this.#applyFilter();
      });
    }

    this.#applyFilter();
  }

  /** Filtrado puramente visual: sin acentos y por carpeta. */
  #applyFilter() {
    const needle = foldAccents(this.#search).trim();
    const folder = this.#folder;
    let shown = 0;

    for (const row of this.element.querySelectorAll("[data-npc-row]")) {
      const okText = !needle || (row.dataset.search ?? "").includes(needle);
      const okFolder = !folder || row.dataset.folder === folder;
      const visible = okText && okFolder;
      row.hidden = !visible;
      if (visible) shown++;
    }

    const empty = this.element.querySelector("[data-npc-empty]");
    if (empty) empty.hidden = shown > 0;
  }

  // --- acciones: grupo ------------------------------------------------------

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

  // --- acciones: encuentro --------------------------------------------------

  #loadEncounter(result) {
    if (result.error) return ui.notifications.warn(t(result.error));
    this.#encounter = result.monsters;
    this.#invalidate();
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
    this.#invalidate();
    this.render();
  }

  static #onRemoveMonster(event, target) {
    const id = target.dataset.actorId;
    this.#encounter = this.#encounter.filter((m) => m.actorId !== id);
    this.#invalidate();
    this.render();
  }

  static #onAddNpc(event, target) {
    const id = target.dataset.actorId;
    const actor = game.actors.get(id);
    if (!actor) return;
    const existing = this.#encounter.find((m) => m.actorId === id);
    if (existing) existing.count += 1;
    else this.#encounter.push({ actorId: id, name: actor.name, count: 1 });
    this.#invalidate();
    this.render();
  }

  static #onBumpCount(event, target) {
    const { actorId, delta } = target.dataset;
    const m = this.#encounter.find((x) => x.actorId === actorId);
    if (!m) return;
    m.count = Math.max(1, m.count + Number(delta));
    this.#invalidate();
    this.render();
  }

  // --- acciones: encuentros guardados ---------------------------------------

  static async #onSaveEncounter() {
    if (!this.#encounter.length)
      return ui.notifications.warn(t("GGEL.warn.noEncounter"));

    const input = this.element.querySelector("[data-enc-name]");
    const name = (input?.value ?? "").trim();
    if (!name) return ui.notifications.warn(t("GGEL.warn.noName"));

    const list = [...this.#savedEncounters()];
    const payload = {
      id: foundry.utils.randomID(),
      name,
      monsters: this.#encounter.map(({ actorId, name: n, count }) => ({
        actorId,
        name: n,
        count,
      })),
    };
    // Guardar con un nombre existente lo sobrescribe: es lo que espera
    // cualquiera que corrige un encuentro y vuelve a guardarlo.
    const at = list.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
    if (at >= 0) list[at] = { ...payload, id: list[at].id };
    else list.push(payload);

    await game.settings.set(MODULE_ID, SETTINGS.ENCOUNTERS, list);
    ui.notifications.info(t("GGEL.ui.saved", { name }));
    if (input) input.value = "";
    this.render();
  }

  static #onLoadEncounter(event, target) {
    const enc = this.#savedEncounters().find((e) => e.id === target.dataset.encId);
    if (!enc) return;
    // Un actor puede haberse borrado desde que se guardó el encuentro.
    const alive = enc.monsters.filter((m) => game.actors.get(m.actorId));
    if (alive.length < enc.monsters.length) {
      ui.notifications.warn(
        t("GGEL.warn.missingActors", { n: enc.monsters.length - alive.length })
      );
    }
    this.#encounter = alive.map((m) => ({ ...m }));
    this.#invalidate();
    this.render();
  }

  static async #onDeleteEncounter(event, target) {
    const list = this.#savedEncounters().filter((e) => e.id !== target.dataset.encId);
    await game.settings.set(MODULE_ID, SETTINGS.ENCOUNTERS, list);
    this.render();
  }

  // --- análisis -------------------------------------------------------------

  static #onAnalyze() {
    if (!this.#party.size) return ui.notifications.warn(t("GGEL.warn.noParty"));
    if (!this.#encounter.length)
      return ui.notifications.warn(t("GGEL.warn.noEncounter"));
    this.#recompute();
  }

  /** Recalcula informe y plan. Lo usan el botón y el selector de rondas. */
  #recompute() {
    const members = [];
    for (const id of this.#party) {
      const actor = game.actors.get(id);
      if (actor) members.push(extractPC(actorToProbe(actor)));
    }

    const monsters = [];
    for (const e of this.#encounter) {
      const actor = game.actors.get(e.actorId);
      if (actor) monsters.push(extractNPC(actorToProbe(actor), e.count));
    }

    if (!members.length || !monsters.length) {
      return ui.notifications.warn(t("GGEL.warn.noEncounter"));
    }

    const party = { members };
    const encounter = { monsters };
    const raw = analyze(party, encounter);
    this.#report = localizeReport(raw);
    this.#report.raw = raw;

    // El informe dice qué está mal; el plan dice qué hacer con eso.
    const rawPlan = planTurns(party, encounter, { rounds: this.#rounds });
    this.#plan = localizePlan(rawPlan);
    this.#plan.raw = rawPlan;
    this.render();
  }

  static async #onCopy() {
    if (!this.#report?.raw) return;
    await game.clipboard.copyPlainText(renderText(this.#report.raw, this.#plan?.raw));
    ui.notifications.info(t("GGEL.ui.copied"));
  }

  // --- apertura -------------------------------------------------------------

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
