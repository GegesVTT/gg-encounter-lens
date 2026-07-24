// GG Encounter Lens — constantes compartidas.
export const MODULE_ID = "gg-encounter-lens";

export const SETTINGS = {
  PARTY: "party", // ids de PJ elegidos a mano (por cliente)
  ENCOUNTERS: "encounters", // encuentros guardados con nombre (por mundo)
};

// Tope de resultados VISIBLES a la vez en el selector. Se renderizan TODOS los
// PNJs del mundo (con imagenes diferidas) y el tope se aplica despues de
// filtrar: recortar antes de buscar dejaria fuera del alcance de la busqueda a
// todo lo que caiga despues del corte alfabetico.
export const NPC_RESULT_CAP = 60;
