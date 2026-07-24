// GG Encounter Lens — constantes compartidas.
export const MODULE_ID = "gg-encounter-lens";

export const SETTINGS = {
  PARTY: "party", // ids de PJ elegidos a mano (por cliente)
  ENCOUNTERS: "encounters", // encuentros guardados con nombre (por mundo)
};

// Tope de resultados renderizados en el selector. Con mundos grandes, pintar
// cientos de filas con imagen es caro; filtrar en el DOM sobre un subconjunto
// razonable mantiene la búsqueda instantánea.
export const NPC_RESULT_CAP = 300;
