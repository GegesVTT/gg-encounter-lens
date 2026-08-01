<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-encounter-lens/main/docs/images/icon.png" width="120" alt="GG Encounter Lens">
</p>

<h1 align="center">GG Encounter Lens</h1>

<p align="center">
  <strong>Party-aware encounter analysis for D&D 5e, straight from Foundry VTT</strong><br>
  Mismatch <strong>briefing</strong> · round-by-round <strong>combat plan</strong> · <strong>contingencies</strong> for when the fight turns
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Foundry-v13-green" alt="Foundry v13">
  <img src="https://img.shields.io/badge/D%26D-5e-red" alt="D&D 5e">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT">
  <img src="https://img.shields.io/github/v/release/GegesVTT/gg-encounter-lens" alt="Latest Release">
</p>

<p align="center"><strong>English</strong> · <a href="#-español">Español</a></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/GegesVTT/gg-encounter-lens/main/docs/images/cover.png" width="100%" alt="GG Encounter Lens — GegesVTT">
</p>

---

## Screenshots

**The briefing** — not a difficulty score, a list of things that will actually go wrong:

![Briefing](https://raw.githubusercontent.com/GegesVTT/gg-encounter-lens/main/docs/images/screenshot-briefing.jpg)

**The panel** — pick who is at the table, load monsters from the canvas or the combat tracker:

![Panel](https://raw.githubusercontent.com/GegesVTT/gg-encounter-lens/main/docs/images/screenshot-panel.jpg)

**The combat plan** — what each monster does, against whom, and why:

![Combat plan](https://raw.githubusercontent.com/GegesVTT/gg-encounter-lens/main/docs/images/screenshot-plan.jpg)

---

## ✨ Features

Every encounter builder answers the same question: *how hard is this, in XP?* None of them answer the one a GM actually asks: **how will this party fare against this monster?**

- **🔍 Mismatch briefing** — reads your party's real damage types, save spread, reach and defences, cross-references them against the monsters' stat blocks, and returns colour-coded findings (🔴 threat · 🟡 friction · 🟢 advantage) in plain language.
- **Auditable, not oracular** — every save flag shows the character's actual modifier and failure chance (`Bula +3 → 65%`). You can check the maths instead of taking the tool's word for it.
- **⚔️ Combat plan** — 2 to 5 rounds of suggested monster actions, scored by expected impact against *this* party. Opens with control, closes with damage, respects recharge and limited uses, and keeps legendary and lair actions on their own tracks.
- **Contingencies** — what to do when the monster is bloodied, when a character drops, and which save to keep leaning on if the fight stalls.
- **🔎 NPC picker** — search your world's monsters by name (accents optional, so `aparicion` finds *Aparición*), filter by folder, set how many of each. Search reaches every NPC in the world, not just the first screenful. Plan a fight days before a single token touches the canvas.
- **💾 Saved encounters** — name an encounter and reload it on game night. Prep on Tuesday, play on Saturday.
- **Three ways in** — the eye icon in the scene controls (or `Alt+L`), a button in the combat tracker that loads the fight in progress, and the picker itself.
- **No AI, no API key, no network** — the planner is deterministic and rule-based, so it works offline and gives the same answer twice.
- GM-only, fully localized in **English and Spanish**.

### 🎯 The six checks

| # | Check | Question it answers |
|---|-------|---------------------|
| 1 | **Damage matchup** | Do their damage types collide with resistances or immunities? |
| 2 | **Partial immunity** | Is *one* character's main damage type dead against this monster? |
| 3 | **Save matchup** | Which save does the monster target, and who fails it? |
| 4 | **Soft spot** | Is one save targeted by *several* monsters at once? |
| 5 | **Reach & mobility** | Can anyone touch a flyer or a shooter? |
| 6 | **Action economy & defensive read** | Are they outnumbered? Who is the weak link, and how many hits until they drop? |

The defensive read measures a monster's **full round**, multiattack included — not one lonely claw.

A monster with ten eye rays produces **four grouped findings**, not ten. Consolidation by ability is the difference between signal and noise.

The XP/CR baseline appears **as context only**, never as a verdict.

## 💡 Beyond the panel

- **Prep the fight, not just the stat block** — the plan is a script you can skim mid-session instead of improvising a dragon's tactics at 11pm.
- **Paste it into your notes** — one button copies briefing and plan as plain text, ready for a journal entry or your prep doc.
- **Sanity-check homebrew** — build the monster, run it against your real party, see whether it lands where you meant it to.

## 📦 Installation

In Foundry: **Add-on Modules → Install Module** and paste the manifest URL:

```
https://github.com/GegesVTT/gg-encounter-lens/releases/latest/download/module.json
```

Then enable **GG Encounter Lens** in *Manage Modules* of your dnd5e world. (Manual alternative: drop the `gg-encounter-lens` folder into `Data/modules/`.)

## 🚀 Usage

Two entry points, both GM-only:

- **Scene controls** — the eye 👁 icon in the token tools, or the `Alt+L` shortcut.
- **Combat tracker** — the button in the tracker header loads the fight already running.

In the panel: tick the characters who are at the table (the selection is remembered between sessions), then build the encounter — **search the world's NPCs**, pull them **from selected tokens**, or grab the **combat tracker**. Adjust quantities with `+` / `−`, save the encounter under a name to reload it later, pick how many rounds to plan, and read the omens.

> Analysis runs on live actor data, so ability modifiers, AC and hit points come out exactly as the sheet shows them — active effects included.

## 🔌 Macro API

```js
const api = game.modules.get("gg-encounter-lens").api;

api.open();                        // open the panel
api.open({ fromCombat: true });    // open it with the current fight loaded

// Analyse without touching the UI
const party = ["Rahegal", "Xanax", "Bula"].map(n => game.actors.getName(n));
const foes  = [{ actor: game.actors.getName("Beholder"), count: 1 }];

const { report, plan } = api.analyze(party, foes, { rounds: 3 });
console.log(report.verdict, report.notes, plan.rounds, plan.contingencies);

// Straight to plain text, ready to paste into a journal
const text = api.toText(party, foes, { rounds: 4 });
```

## ✅ Compatibility

- Foundry VTT **v13** (uses ApplicationV2 and the v13 scene-control API; not tested on v12, so it is not declared).
- **dnd5e** — verified on 5.x. Damage, attack bonuses and save DCs are read from the system's **activities**, so the numbers match what the sheet rolls.
- Actor types: `character` for the party, `npc` for the encounter.
- PF2e is not supported yet — its encounter maths is a different beast.

## 🛠️ Technical notes

- **Strict separation**: `extract.mjs` (system JSON → normalised IR) → `analyze.mjs` / `tactics.mjs` (IR → structured findings) → `i18n.mjs` + the panel (findings → text). The engines know nothing about Foundry or dnd5e and emit `{key, data}` notes, never finished strings, so they are testable outside Foundry and work in any language.
- **`bridge.mjs` is the only file that touches Foundry documents.** It feeds live actors through `actor.toObject()` — which returns the same shape as an exported JSON — and layers the runtime-derived values on top.
- **Two paths, one code path.** Exported *PC* JSON stores almost no derived values (`ac:{flat:null}`, `hp.max:null`, no save totals, no level); *NPC* JSON stores everything resolved. The extractor always prefers a derived value and only reconstructs one as a fallback, so inside Foundry there is no estimation at all — and any value that *was* estimated is flagged in the briefing rather than passed off as fact.
- **Activities are merged per item, not scored individually.** A wraith's Life Drain is one attack roll *plus* a Constitution save on the same action; treating them as rival moves made the planner describe half an action.
- **`activation.type` separates** actions, bonus actions, legendary actions, lair actions and passive traits. A lair action happens on initiative 20 and a passive trait is not a move at all — the plan would be nonsense without that split.
- **Multiattack detection degrades in three tiers, never silently.** dnd5e keeps the routine in prose, and matching the word *Multiattack* breaks in a Spanish world. So: (1) the routine is read exactly when the description names two or more of the monster's own attacks — or a single one repeated with a count, since `three tentacle attacks` is every bit as readable as `two with its claws`; (2) if it does not — half-translated compendiums often mix `Mordisco` with `Claw` — the feature is still flagged and the monster's weapons are listed so the GM can build the round; (3) only a trait with no relation to its attacks is ignored. A round that hits harder than the tool shows is stated outright rather than quietly under-reported.
- **Recharge is read from all the shapes it takes in the wild** — `uses.recovery`, activity-level uses, and the legacy `system.recharge` written by third-party importers — so a dragon's breath weapon does not come back every round.
- **A monster that multiattacks is never offered a lone attack** in the plan. Its round is the routine, not one claw.
- **Ability modifiers are added to base weapon damage.** They do not live in the damage parts, so leaving them out under-counted every attack — a wraith's Life Drain read 18 instead of the stat block's 21.
- The planner scores every move as expected impact in damage-equivalent points, values control above raw damage (losing a turn costs more than the hit that caused it), and biases toward control on round 1 and damage from round 3.
- **Known limitation:** many monsters store the range of save-based effects only in prose — a beholder's eye rays carry `range:{units:"self"}` in structured data. The reach check under-reports for those. Documented rather than papered over.

## 🧭 Roadmap

- **HTML/PDF export** of briefing and plan, in the Crónicas Bárdicas look — a one-page sheet to bring to the table.
- **Compendium search** in the NPC picker, for GMs who never import monsters into the world.
- **Party Packet** integration: encounter analysis alongside the group's sheets.
- **Pathfinder 2e**, once the encounter maths is worth doing properly.
- Playing something else? [Open an issue](https://github.com/GegesVTT/gg-encounter-lens/issues).

## 🏷️ Keywords

encounter builder · encounter balance · encounter analysis · combat planner · monster tactics · GM tools · session prep · party analysis · resistances · immunities · saving throws · action economy · D&D 5e · dnd5e · Foundry VTT

## 📜 License

MIT — © Geges

Part of **Crónicas Bárdicas**, the Foundry VTT module suite by Geges (Gonzalo Gesualdo): [GG Sheet Export](https://github.com/GegesVTT/gg-sheet-export) · [GG Nameforge](https://github.com/GegesVTT/gg-nameforge)

---

## 🇪🇸 Español

**Análisis de encuentros consciente del grupo para D&D 5e, directo desde Foundry VTT.** Informe de **desajustes** · **plan de combate** ronda por ronda · **contingencias** para cuando la pelea se tuerce.

### ✨ Características

Todos los constructores de encuentros responden la misma pregunta: *¿cuán difícil es esto, en XP?* Ninguno responde la que el DM realmente se hace: **¿cómo le va a ir a este grupo contra este monstruo?**

- **🔍 Informe de desajustes** — lee los tipos de daño reales de tu grupo, su reparto de salvaciones, su alcance y sus defensas, los cruza contra el stat block de los monstruos y devuelve hallazgos con semáforo (🔴 amenaza · 🟡 fricción · 🟢 ventaja) en lenguaje llano.
- **Auditable, no oracular** — cada marca de salvación muestra el modificador real del personaje y su probabilidad de fallo (`Bula +3 → 65%`). Podés verificar la cuenta en vez de creerle a la herramienta.
- **⚔️ Plan de combate** — de 2 a 5 rondas de acciones sugeridas, puntuadas por impacto esperado contra *este* grupo. Abre con control, cierra con daño, respeta recargas y usos limitados, y mantiene legendarias y acciones de guarida en sus propios carriles.
- **Contingencias** — qué hacer cuando el monstruo queda malherido, cuando cae un PJ, y sobre qué salvación insistir si el combate se estanca.
- **🔎 Selector de PNJs** — buscá los monstruos de tu mundo por nombre (sin acentos también: `aparicion` encuentra *Aparición*), filtrá por carpeta y elegí cuántos de cada uno. La búsqueda alcanza a todos los PNJs del mundo, no solo a los primeros que entran en pantalla. Podés armar la pelea días antes de que un token toque el mapa.
- **💾 Encuentros guardados** — poné nombre a un encuentro y recuperalo el día de la partida. Preparás el martes, jugás el sábado.
- **Tres vías de entrada** — el ícono del ojo en los controles de escena (o `Alt+L`), un botón en el rastreador de combate que carga la pelea en curso, y el propio selector.
- **Sin IA, sin clave de API y sin red** — el planificador es determinista y por reglas: funciona offline y da la misma respuesta dos veces.
- Solo para el DM, localizado en **español e inglés**.

### 🎯 Los seis chequeos

| # | Chequeo | Qué responde |
|---|---------|--------------|
| 1 | **Cruce de daño** | ¿Sus tipos de daño chocan con resistencias o inmunidades? |
| 2 | **Inmunidad parcial** | ¿La vía de daño principal de *un* PJ muere contra este bicho? |
| 3 | **Cruce de salvaciones** | ¿A qué salvación apunta el monstruo y quién la falla? |
| 4 | **Punto débil** | ¿Hay una salvación castigada por *varios* monstruos a la vez? |
| 5 | **Alcance y movilidad** | ¿Alguien puede tocar a un volador o a un tirador? |
| 6 | **Economía de acción y lectura defensiva** | ¿Los superan en número? ¿Quién es el eslabón débil y en cuántos golpes cae? |

La lectura defensiva mide la **ronda completa** del monstruo, multiataque incluido — no una garra suelta.

Un monstruo con diez rayos oculares produce **cuatro hallazgos agrupados**, no diez. La consolidación por habilidad es la diferencia entre señal y ruido.

El baseline de VD/XP aparece **solo como contexto**, nunca como dictamen.

### 💡 Más allá del panel

- **Preparar la pelea, no solo el stat block** — el plan es un guion que podés repasar en plena sesión en vez de improvisar la táctica de un dragón a las 11 de la noche.
- **Pegalo en tus notas** — un botón copia informe y plan como texto plano, listo para un journal o tu documento de prep.
- **Revisar homebrew** — armás el monstruo, lo corrés contra tu grupo real, y ves si cae donde querías.

### 📦 Instalación

En Foundry: **Módulos Complementarios → Instalar Módulo** y pegá la URL de manifiesto:

```
https://github.com/GegesVTT/gg-encounter-lens/releases/latest/download/module.json
```

Después activá **GG Encounter Lens** en *Gestionar Módulos* de tu mundo dnd5e. (Alternativa manual: copiá la carpeta `gg-encounter-lens` dentro de `Data/modules/`.)

### 🚀 Uso

Dos vías de entrada, ambas solo para el DM:

- **Controles de escena** — el ícono del ojo 👁 en las herramientas de token, o el atajo `Alt+L`.
- **Rastreador de combate** — el botón del header carga la pelea que ya está corriendo.

En el panel: tildá los personajes que están en la mesa (la selección se recuerda entre sesiones) y armá el encuentro — **buscando entre los PNJs del mundo**, **desde los tokens seleccionados** o **desde el combate**. Ajustá cantidades con `+` / `−`, guardá el encuentro con un nombre para recuperarlo después, elegí cuántas rondas planificar, y leé los augurios.

> El análisis corre sobre los datos vivos del actor: los modificadores, la CA y los PV salen exactamente como los muestra la ficha, efectos activos incluidos.

### 🔌 API para macros

```js
const api = game.modules.get("gg-encounter-lens").api;

api.open();                        // abre el panel
api.open({ fromCombat: true });    // lo abre con el combate actual cargado

// Analizar sin tocar la interfaz
const grupo = ["Rahegal", "Xanax", "Bula"].map(n => game.actors.getName(n));
const bichos = [{ actor: game.actors.getName("Beholder"), count: 1 }];

const { report, plan } = api.analyze(grupo, bichos, { rounds: 3 });
console.log(report.verdict, report.notes, plan.rounds, plan.contingencies);

// Directo a texto plano, listo para pegar en un journal
const texto = api.toText(grupo, bichos, { rounds: 4 });
```

### ✅ Compatibilidad

- Foundry VTT **v13** (usa ApplicationV2 y la API de controles de escena de v13; no está probado en v12, así que no se declara).
- **dnd5e** — verificado en 5.x. El daño, los bonos de ataque y las CD de salvación se leen de las **activities** del sistema: los números coinciden con lo que tira la ficha.
- Tipos de actor: `character` para el grupo, `npc` para el encuentro.
- PF2e todavía no está soportado — su matemática de encuentros es otra bestia.

### 🛠️ Notas técnicas

- **Separación estricta**: `extract.mjs` (JSON del sistema → IR normalizada) → `analyze.mjs` / `tactics.mjs` (IR → hallazgos estructurados) → `i18n.mjs` y el panel (hallazgos → texto). Los motores no saben nada de Foundry ni de dnd5e y emiten notas `{key, data}`, nunca cadenas armadas: son testeables fuera de Foundry y funcionan en cualquier idioma.
- **`bridge.mjs` es el único archivo que toca documentos de Foundry.** Pasa los actores vivos por `actor.toObject()` —que devuelve la misma forma que un JSON exportado— y le superpone los valores derivados en runtime.
- **Dos caminos, un solo código.** El JSON exportado de un *PJ* casi no guarda valores derivados (`ac:{flat:null}`, `hp.max:null`, sin totales de salvación ni nivel); el de un *PNJ* los guarda todos resueltos. El extractor siempre prefiere el valor derivado y solo reconstruye como fallback, así que dentro de Foundry no hay ninguna estimación — y si algún valor *sí* se estimó, el informe lo avisa en vez de disimularlo.
- **Las activities se fusionan por ítem, no se puntúan por separado.** El Life Drain de una aparición es una tirada de ataque *más* una salvación de Constitución en la misma acción; tratarlas como movidas rivales hacía que el plan describiera media acción.
- **`activation.type` separa** acciones, acciones adicionales, legendarias, de guarida y rasgos pasivos. Una acción de guarida ocurre en iniciativa 20 y un rasgo pasivo no es una movida: sin esa distinción el plan sería un disparate.
- **El multiataque degrada en tres niveles, nunca en silencio.** dnd5e guarda la rutina en prosa, y buscar la palabra *Multiattack* rompe en un mundo en español. Entonces: (1) la rutina se lee exacta cuando la descripción nombra dos o más de sus propios ataques —o uno solo repetido con cuenta, porque `hace tres ataques con su tentáculo` es tan legible como `dos con sus garras`—; (2) si no —los compendios a medio traducir mezclan `Mordisco` con `Claw` todo el tiempo—, el rasgo se marca igual y se listan las armas del bicho para que el DM arme la ronda; (3) solo se ignora un rasgo que no tenga relación con sus ataques. Que la ronda real pegue más de lo que muestra la herramienta se dice de frente, no se subestima callando.
- **La recarga se lee en todas las formas que toma en la práctica** — `uses.recovery`, usos a nivel de activity, y el `system.recharge` heredado que escriben los importadores de terceros — para que el aliento de un dragón no vuelva cada ronda.
- **A un monstruo que multiataca nunca se le ofrece un ataque suelto** en el plan. Su ronda es la rutina, no una garra.
- **El modificador de característica se suma al daño base del arma.** No vive en las partes de daño, así que omitirlo subcontaba todos los ataques — el Life Drain de una aparición daba 18 en vez de los 21 del stat block.
- El planificador puntúa cada movida como impacto esperado en puntos de daño equivalente, valora el control por encima del daño bruto (perder un turno cuesta más que el golpe que lo causó), y sesga hacia el control en la ronda 1 y hacia el daño desde la 3.
- **Limitación conocida:** muchos monstruos guardan el alcance de sus efectos con salvación solo en la prosa — los rayos de un beholder llevan `range:{units:"self"}` en los datos estructurados. El chequeo de alcance sub-reporta en esos casos. Documentado, no tapado.

### 🧭 Hoja de ruta

- **Exportación HTML/PDF** del informe y el plan, con la estética Crónicas Bárdicas — una hoja para llevar a la mesa.
- **Búsqueda en compendios** dentro del selector, para quienes nunca importan los bichos al mundo.
- Integración con **Party Packet**: análisis del encuentro junto a las fichas del grupo.
- **Pathfinder 2e**, cuando su matemática de encuentros valga la pena hacerse bien.
- ¿Jugás otra cosa? [Abrí un issue](https://github.com/GegesVTT/gg-encounter-lens/issues).

### 🏷️ Palabras clave

constructor de encuentros · balance de encuentros · análisis de encuentros · planificador de combate · táctica de monstruos · herramientas de DM · preparación de sesión · análisis del grupo · resistencias · inmunidades · salvaciones · economía de acción · D&D 5e · dnd5e · Foundry VTT

### 📜 Licencia

MIT — © Geges

Parte de **Crónicas Bárdicas**, la suite de módulos para Foundry VTT de Geges (Gonzalo Gesualdo): [GG Sheet Export](https://github.com/GegesVTT/gg-sheet-export) · [GG Nameforge](https://github.com/GegesVTT/gg-nameforge)

---

<p align="center"><em>GG Encounter Lens · GegesVTT · Crónicas Bárdicas</em></p>
