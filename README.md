# GG Encounter Lens

> Party-aware encounter analysis for Foundry VTT (D&D 5e).
> Part of the **GegesVTT** family — *Crónicas Bárdicas*.

Every encounter builder answers the same question: *how hard is this, in XP?*
None of them answer the question a GM actually asks: **how will this specific
party fare against this specific monster?**

GG Encounter Lens reads your party's real damage types, save spread, reach and
defences, cross-references them against the monsters' stat blocks, and returns a
plain-language briefing of *mismatches* — colour-coded, not scored.

```
🔴  Beholder: 3 effects call for WIS (DC 16)
     Likely to fail: Ainé, GPT-O, Ofelia (party average 63%).
🟡  Aparición resists half the party's damage
     Resists acid / bludgeoning / cold / fire / lightning / piercing / slashing.
🟡  Ofelia (AC 13, 58 HP) is the weak link
     Life Drain hits at +6 (~70%) for ~18: drops her in 4 hits.
ℹ️  Context: total CR 15 vs total level 24 — a reference, not a verdict.
```

## The five checks

| # | Check | Question it answers |
|---|-------|---------------------|
| 1 | Damage matchup | Do their damage types collide with resistances or immunities? |
| 2 | Save matchup | Which save does the monster target, and who fails it? |
| 3 | Reach & mobility | Can anyone touch a flyer or a shooter? |
| 4 | Action economy | Are they outnumbered in actions per round? |
| 5 | Defensive read | Who is the weak link, and how many hits until they drop? |
| 6 | Soft spot | Is one save targeted by *several* monsters at once? |

Save notes show each character's actual modifier and failure chance
(`Bula +3 → 65%`) so the GM can audit any flag rather than take it on faith.
The XP/CR baseline appears **as context only**, never as a verdict.

## The combat plan

Reading the mismatches is half the job; the other half is running the monsters
like they mean it. The planner turns the same analysis into a round-by-round
script — deterministic, no API key, no network:

```
── Round 1 ──
  • Tyrant uses Paralysing Ray on Ofelia
    CON DC 16: Ofelia fails 60%. Pure control — taking them out of the round
    beats raw damage.
  • Legendary action: Tail swipe
── Contingencies ──
  • Save Breath for when the Tyrant is bloodied
  • If Ofelia drops, focus shifts to Gepeto
```

It scores every move by expected impact against *this* party, opens with control
and closes with damage, respects recharge and limited uses, keeps legendary and
lair actions on their own tracks, and adds contingencies for a bloodied monster,
a fallen character and the party's softest save.

## Using it

Two ways in, both GM-only:

- **Scene controls** → the eye icon in the token tools, or `Alt+L`.
- **Combat tracker** → the button in the tracker header loads the current fight.

Inside the panel, pick the characters who are at the table (the selection is
remembered), load monsters from the selected tokens or from combat, and read the
omens. The briefing can be copied as plain text.

## Architecture

Strict separation, same philosophy as GG Sheet Export:

```
extraction (system JSON) → normalised IR → analysis → presentation
   extract.mjs                          analyze.mjs    i18n.mjs + lens-app.mjs
      ↑
  bridge.mjs (the only file that touches Foundry documents)
```

`analyze.mjs` knows nothing about Foundry or dnd5e — only the IR. It emits
structured notes (`{sev, key, data}`), never finished strings, so the same engine
works in any language and is testable outside Foundry.

### The two-path finding

Exported **PC** JSON contains almost no derived values: `ac:{flat:null}`,
`hp.max:null`, no ability modifiers or save totals, `details.level` undefined.
Foundry computes those at runtime. **NPC** JSON, by contrast, stores everything
resolved. The extractor therefore always prefers a derived value and only
reconstructs one as a fallback — and `bridge.mjs` feeds live actors through
`actor.toObject()` plus derived values, so inside Foundry there is no estimation
at all. Estimated values are flagged in the briefing when they do occur.

### Two more data-model findings

`activation.type` cleanly separates actions, bonus actions, legendary actions,
lair actions and passive traits — the planner needs that split, because a lair
action happens on initiative 20 and a passive trait is not a move at all.

Activities are merged **per item**, not treated individually: a wraith's Life
Drain is one attack roll *plus* a Constitution save on the same action, and
scoring them as rival moves made the plan describe half an action.

### Known limitation

Many monsters store the range of save-based effects only in prose — a beholder's
eye rays carry `range:{units:"self"}` in structured data. The reach check
under-reports for those. Documented rather than papered over.

## Development

```bash
node tests/run-all.mjs   # everything below, in order
node tests/audit.mjs     # imports, i18n keys, templates, module.json coherence
node tests/run.mjs       # synthetic fixtures: each rule in isolation
node tests/tactics.mjs   # new checks + the combat planner
node tests/probe.mjs     # extraction against real exported actors
node tests/real.mjs      # full pipeline, both languages
```

The probe suites read exported actor JSON from `/mnt/user-data/uploads` and skip
themselves when it is absent, so CI stays green.

## Status

**v0.2.0** — analysis and combat planning, validated against real campaign data.

- [x] Analysis engine + six checks
- [x] Per-character transparency on every save flag
- [x] Deterministic combat plan with contingencies
- [x] dnd5e 5.x extractor, probe-validated
- [x] Foundry panel (canvas + combat tracker entry points)
- [x] Full i18n (English / Spanish)
- [ ] HTML/PDF export with Crónicas Bárdicas styling
- [ ] PF2e support

---

## Español

Análisis de encuentros **consciente del grupo** para Foundry VTT (D&D 5e).

En vez de un número de dificultad, el módulo lee los tipos de daño reales de tu
party, su reparto de salvaciones, su alcance y sus defensas, los cruza contra el
stat block de los monstruos y devuelve un informe legible de *desajustes*: qué
los va a lastimar y por qué.

**Cómo se usa:** el ícono del ojo en los controles de escena (o `Alt+L`), o el
botón en el rastreador de combate. Elegís los personajes que están en la mesa,
cargás monstruos desde los tokens seleccionados o desde el combate, y leés los
augurios. El informe se puede copiar como texto, plan de combate incluido.

Además del informe, el módulo arma un **plan de combate** de 2 a 5 rondas: qué
movida usa cada monstruo, contra quién y por qué, más contingencias para cuando
el bicho queda malherido o cae un PJ. Todo determinista — sin IA, sin clave de
API y sin red.

El baseline de VD/XP se muestra **solo como contexto**, nunca como dictamen.

**Instalación:** pegá la URL del manifiesto en Foundry →
`https://github.com/GegesVTT/gg-encounter-lens/releases/latest/download/module.json`
