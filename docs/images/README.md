# Imágenes del README

Archivos que espera el README (sin ellos, GitHub muestra el ícono roto):

| Archivo | Uso | Tamaño sugerido | Estado |
|---|---|---|---|
| `icon.png` | Ícono centrado arriba del título | 512×512 px, fondo transparente | ✅ listo |
| `cover.png` | Banner ancho bajo los badges | 1280×640 px | ✅ listo |
| `screenshot-briefing.jpg` | El informe con banderas rojas | ancho ≥ 1000 px | pendiente |
| `screenshot-panel.jpg` | Panel con grupo y encuentro cargados | ancho ≥ 1000 px | pendiente |
| `screenshot-plan.jpg` | Plan de combate con contingencias | ancho ≥ 1000 px | pendiente |

Los tres screenshots se sacan del propio panel: recortá solo la ventana del
módulo, sin la consola ni el resto de la interfaz de Foundry.


## Regenerar icon.png y cover.png

```bash
python3 docs/make_assets.py     # escribe en docs/out/
```

El script está parametrizado: la constante `FONT_DISPLAY` apunta hoy a Poiret One
porque Uncial Antiqua no estaba disponible sin red. Cambiándola por la ruta a
`UncialAntiqua-Regular.ttf` se regenera con la tipografía de marca exacta.

El racional de diseño está en `docs/filosofia-visual.md`.
