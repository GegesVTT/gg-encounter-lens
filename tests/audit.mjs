// Auditoría pre-publicación — atrapa lo que `node --check` NO ve:
//   • imports que no resuelven
//   • claves i18n usadas pero ausentes en lang/*.json
//   • claves definidas pero muertas (nadie las usa)
//   • desalineación entre en.json y es.json
//   • module.json declarando archivos inexistentes
//   • funciones duplicadas dentro de un mismo archivo
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const problems = [];
const warn = (m) => problems.push(m);

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const rel = (p) => path.relative(ROOT, p);
const scripts = walk(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs"));
const templates = walk(path.join(ROOT, "templates")).filter((f) => f.endsWith(".hbs"));

// --- 1. imports resuelven ----------------------------------------------------
for (const file of scripts) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!fs.existsSync(target)) warn(`import sin resolver: ${rel(file)} → ${m[1]}`);
  }
}

// --- 2. funciones duplicadas -------------------------------------------------
for (const file of scripts) {
  const src = fs.readFileSync(file, "utf8");
  const seen = new Map();
  for (const m of src.matchAll(/^\s*(?:export\s+)?function\s+([A-Za-z0-9_$]+)/gm)) {
    seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  }
  for (const [name, n] of seen) {
    if (n > 1) warn(`función duplicada "${name}" (${n}×) en ${rel(file)}`);
  }
}

// --- 3. claves i18n ----------------------------------------------------------
const langs = {};
for (const lang of ["en", "es"]) {
  const p = path.join(ROOT, "lang", `${lang}.json`);
  if (!fs.existsSync(p)) { warn(`falta lang/${lang}.json`); continue; }
  langs[lang] = JSON.parse(fs.readFileSync(p, "utf8"));
}

// Los comentarios pueden contener claves de ejemplo que NO son uso real.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "") // bloque JS
    .replace(/^\s*\/\/.*$/gm, "") // línea JS
    .replace(/\{\{!--[\s\S]*?--\}\}/g, ""); // comentario Handlebars

const used = new Set();
for (const file of [...scripts, ...templates]) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  for (const m of src.matchAll(/["'](GGEL\.[A-Za-z0-9_.]+)["']/g)) used.add(m[1]);
}


// Una clave usada puede ser simple ("GGEL.ui.plan") o un par head/body
// ("GGEL.note.softSpot" → .head + .body). Se deduce por presencia, no por
// prefijo: así no hay que mantener listas al agregar familias de claves.
for (const [lang, dict] of Object.entries(langs)) {
  for (const key of used) {
    if (key in dict) continue;
    for (const suffix of [".head", ".body"]) {
      if (!(`${key}${suffix}` in dict))
        warn(`clave i18n faltante en ${lang}.json: ${key}${suffix}`);
    }
  }
}

// Claves muertas (solo se informan contra en.json para no duplicar ruido).
if (langs.en) {
  const expected = new Set();
  for (const k of used) {
    expected.add(k);
    expected.add(`${k}.head`);
    expected.add(`${k}.body`);
  }
  for (const key of Object.keys(langs.en)) {
    if (!expected.has(key)) warn(`clave i18n muerta (nadie la usa): ${key}`);
  }
}

// Ambos idiomas deben tener el mismo juego de claves.
if (langs.en && langs.es) {
  for (const k of Object.keys(langs.en))
    if (!(k in langs.es)) warn(`clave presente en en.json y ausente en es.json: ${k}`);
  for (const k of Object.keys(langs.es))
    if (!(k in langs.en)) warn(`clave presente en es.json y ausente en en.json: ${k}`);
}

// --- 4. module.json coherente ------------------------------------------------
const mod = JSON.parse(fs.readFileSync(path.join(ROOT, "module.json"), "utf8"));
for (const f of [
  ...(mod.esmodules ?? []),
  ...(mod.styles ?? []),
  ...(mod.languages ?? []).map((l) => l.path),
]) {
  if (!fs.existsSync(path.join(ROOT, f))) warn(`module.json declara un archivo inexistente: ${f}`);
}
if (mod.download && !mod.download.includes(`v${mod.version}`)) {
  warn(`module.json: download no coincide con version ${mod.version}`);
}

// Toda plantilla referida desde el código debe existir.
for (const file of scripts) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/templates\/([A-Za-z0-9_-]+\.hbs)/g)) {
    if (!fs.existsSync(path.join(ROOT, "templates", m[1])))
      warn(`plantilla faltante: templates/${m[1]} (referida en ${rel(file)})`);
  }
}

// --- informe -----------------------------------------------------------------
if (problems.length) {
  console.log(`✗ AUDITORÍA: ${problems.length} problema(s)\n`);
  for (const p of problems) console.log("  •", p);
  process.exit(1);
}
console.log("✓ AUDITORÍA LIMPIA — imports, i18n, plantillas y module.json coherentes");
