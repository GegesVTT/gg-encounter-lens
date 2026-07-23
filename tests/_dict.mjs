// Carga un lang/*.json y lo instala como diccionario para los tests en Node.
import fs from "node:fs";
import { setDictionary } from "../scripts/i18n.mjs";
export function useLang(lang = "es") {
  const dict = JSON.parse(fs.readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"));
  setDictionary(dict);
  return dict;
}
