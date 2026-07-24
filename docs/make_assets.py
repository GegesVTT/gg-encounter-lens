#!/usr/bin/env python3
"""
GegesVTT — generador de assets de marca para GG Encounter Lens.

Dibuja icon.png (512x512, fondo transparente) y cover.png (1280x640).

Todo se dibuja con supermuestreo x4 y se reduce al final: es la forma de
conseguir bordes limpios en diagonales y trazos finos sin recurrir a filtros.

TIPOGRAFÍA
----------
La marca usa Uncial Antiqua para títulos, pero no está disponible offline en
este entorno. Se usa Poiret One, una tipografía derivada del Art Nouveau
geométrico, que es la vertiente que define la identidad. Para regenerar con la
fuente de marca, cambiá FONT_DISPLAY por la ruta a UncialAntiqua-Regular.ttf.
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

# --- paleta ------------------------------------------------------------------
ROBLE = (25, 18, 13)          # roble negro #19120D
ROBLE_ALTO = (36, 26, 19)
AMBAR = (224, 162, 60)        # ámbar #E0A23C
VINO = (138, 47, 63)          # vino #8A2F3F
PERGAMINO = (232, 220, 196)
TINTA_SUAVE = (155, 140, 114)
VERDE = (95, 122, 91)         # ventaja, para el guiño del semáforo

SS = 4  # supermuestreo

FONTS = "/mnt/skills/examples/canvas-design/canvas-fonts"
FONT_DISPLAY = f"{FONTS}/PoiretOne-Regular.ttf"
FONT_KICKER = f"{FONTS}/CrimsonPro-Regular.ttf"

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)


def rgba(c, a=255):
    return (*c, a)


def octagon(cx, cy, r, chamfer=0.29):
    """Octógono de lados rectos. `chamfer` es la fracción de lado cortada."""
    k = r * chamfer
    return [
        (cx - r + k, cy - r), (cx + r - k, cy - r),
        (cx + r, cy - r + k), (cx + r, cy + r - k),
        (cx + r - k, cy + r), (cx - r + k, cy + r),
        (cx - r, cy + r - k), (cx - r, cy - r + k),
    ]


def lozenge(cx, cy, w, h):
    """Rombo: el punto de la gramática visual."""
    return [(cx, cy - h), (cx + w, cy), (cx, cy + h), (cx - w, cy)]


def eye_hexagon(cx, cy, w, h):
    """
    Ojo geométrico: dos vértices laterales y tramos rectos arriba y abajo.
    Nunca una elipse — la curva está prohibida en la gramática de la marca.
    """
    ix = w * 0.42
    return [
        (cx - w, cy),
        (cx - ix, cy - h), (cx + ix, cy - h),
        (cx + w, cy),
        (cx + ix, cy + h), (cx - ix, cy + h),
    ]


def draw_emblem(d, cx, cy, r, *, plate=True):
    """
    El emblema: octógono con doble filete recto, ojo hexagonal al centro,
    rombo por pupila y rayos angulados. Escalas anidadas del mismo motivo.
    """
    # Placa de fondo
    if plate:
        d.polygon(octagon(cx, cy, r), fill=rgba(ROBLE_ALTO))

    # Doble filete recto: el mismo contorno dicho dos veces con distinto peso.
    d.line(octagon(cx, cy, r) + [octagon(cx, cy, r)[0]],
           fill=rgba(AMBAR, 205), width=max(1, int(r * 0.020)))
    inner = r * 0.885
    d.line(octagon(cx, cy, inner) + [octagon(cx, cy, inner)[0]],
           fill=rgba(AMBAR, 78), width=max(1, int(r * 0.010)))

    # Espigas en las cuatro diagonales: el detalle que recompensa acercarse.
    for ang in (45, 135, 225, 315):
        a = math.radians(ang)
        for i, f in enumerate((0.955, 0.905, 0.855)):
            px, py = cx + math.cos(a) * r * f, cy + math.sin(a) * r * f
            s = r * (0.052 - i * 0.011)
            d.line([(px - s * 0.7, py - s * 0.7), (px + s * 0.7, py + s * 0.7)],
                   fill=rgba(AMBAR, 150 - i * 38), width=max(1, int(r * 0.011)))

    # Rombos cardinales, anclando los ejes.
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        px, py = cx + dx * r * 0.885, cy + dy * r * 0.885
        d.polygon(lozenge(px, py, r * 0.030, r * 0.030), fill=rgba(AMBAR, 230))

    # --- el ojo ---------------------------------------------------------------
    ew, eh = r * 0.700, r * 0.358
    d.polygon(eye_hexagon(cx, cy, ew, eh), fill=rgba(ROBLE, 255))
    d.line(eye_hexagon(cx, cy, ew, eh) + [eye_hexagon(cx, cy, ew, eh)[0]],
           fill=rgba(AMBAR, 255), width=max(1, int(r * 0.026)))

    # Iris: octógono pequeño. El círculo aproximado por rectas.
    ir = r * 0.236
    d.polygon(octagon(cx, cy, ir), fill=rgba(VINO, 205))
    d.line(octagon(cx, cy, ir) + [octagon(cx, cy, ir)[0]],
           fill=rgba(AMBAR, 190), width=max(1, int(r * 0.016)))

    # Pupila: el rombo otra vez, en la escala más chica.
    d.polygon(lozenge(cx, cy, r * 0.093, r * 0.131), fill=rgba(ROBLE, 255))
    d.polygon(lozenge(cx, cy, r * 0.034, r * 0.050), fill=rgba(AMBAR, 255))

    # Rayos: la lente que mira. Simétricos, de peso decreciente.
    for sign in (-1, 1):
        for i, ang in enumerate((-58, -29, 0, 29, 58)):
            a = math.radians(ang - 90 if sign < 0 else ang + 90)
            r0 = eh * 1.62 + r * 0.045
            r1 = r0 + r * (0.126 - abs(i - 2) * 0.022)
            d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0),
                    (cx + math.cos(a) * r1, cy + math.sin(a) * r1)],
                   fill=rgba(AMBAR, 235 - abs(i - 2) * 42),
                   width=max(1, int(r * 0.017)))


def make_icon(path, size=512):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    draw_emblem(d, S / 2, S / 2, S * 0.455)
    img.resize((size, size), Image.LANCZOS).save(path)
    return path


def tracked(d, text, font, cx, y, spacing, fill, anchor_center=True):
    """Texto con tracking manual: PIL no lo hace, y la marca lo necesita amplio."""
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2 if anchor_center else cx
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + spacing
    return total


def make_cover(path, w=1280, h=640):
    W, H = w * SS, h * SS
    img = Image.new("RGB", (W, H), ROBLE)
    d = ImageDraw.Draw(img, "RGBA")

    # Retícula de rombos: textura estructural, casi invisible, que da profundidad
    # sin sombras. Se percibe antes de poder nombrarse.
    step = W * 0.042
    yy = -step
    row = 0
    while yy < H + step:
        xx = -step + (step / 2 if row % 2 else 0)
        while xx < W + step:
            d.polygon(lozenge(xx, yy, step * 0.055, step * 0.078),
                      fill=rgba(AMBAR, 13))
            xx += step
        yy += step * 0.72
        row += 1

    # Viñeta: concentra la mirada en el centro sin oscurecer los bordes de golpe.
    vg = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vg)
    for i in range(46):
        f = i / 46
        vd.ellipse([-W * 0.30 + W * 0.78 * f, -H * 0.55 + H * 1.05 * f,
                    W * 1.30 - W * 0.78 * f, H * 1.55 - H * 1.05 * f],
                   fill=int(150 * f ** 2.1))
    img = Image.composite(img, Image.new("RGB", (W, H), ROBLE), vg)
    d = ImageDraw.Draw(img, "RGBA")

    # Filetes de encuadre: doble, recto, con las esquinas cortadas en chaflán.
    m = W * 0.030
    for off, alpha, wd in ((0, 96, 0.0020), (W * 0.0105, 34, 0.0011)):
        x0, y0, x1, y1 = m + off, m + off, W - m - off, H - m - off
        c = W * 0.026
        d.line([(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
                (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c),
                (x0, y0 + c), (x0 + c, y0)],
               fill=rgba(AMBAR, alpha), width=max(1, int(W * wd)))

    # --- composición: emblema, cabecera, título, filete ------------------------
    cx = W / 2
    draw_emblem(d, cx, H * 0.292, H * 0.198, plate=False)

    f_kicker = ImageFont.truetype(FONT_KICKER, int(H * 0.0335))
    tracked(d, "CRÓNICAS BÁRDICAS", f_kicker, cx, H * 0.545,
            H * 0.0225, rgba(TINTA_SUAVE, 255))

    f_title = ImageFont.truetype(FONT_DISPLAY, int(H * 0.120))
    tracked(d, "GG ENCOUNTER LENS", f_title, cx, H * 0.615,
            H * 0.0115, rgba(AMBAR, 255))

    # Filete con rombo al centro: el separador firma de la marca.
    ry = H * 0.815
    half = W * 0.170
    for x0, x1 in ((cx - half, cx - W * 0.021), (cx + W * 0.021, cx + half)):
        steps = 90
        for i in range(steps):
            a = i / steps
            b = (i + 1) / steps
            fade = 1 - abs(0.5 - a) * 2
            xa = x0 + (x1 - x0) * (a if x0 < cx else 1 - a)
            xb = x0 + (x1 - x0) * (b if x0 < cx else 1 - b)
            d.line([(xa, ry), (xb, ry)], fill=rgba(AMBAR, int(150 * fade + 18)),
                   width=max(1, int(W * 0.0013)))
    d.polygon(lozenge(cx, ry, W * 0.0058, W * 0.0058), fill=rgba(AMBAR, 245))

    # El guiño: los tres tonos del semáforo del informe — amenaza, fricción,
    # ventaja. Quien usó el módulo los reconoce; el resto ve tres marcas.
    gy = H * 0.895
    gap = W * 0.0155
    for i, col in enumerate((VINO, AMBAR, VERDE)):
        gx = cx + (i - 1) * gap
        d.polygon(lozenge(gx, gy, W * 0.0033, W * 0.0033), fill=rgba(col, 210))

    img.resize((w, h), Image.LANCZOS).save(path)
    return path


if __name__ == "__main__":
    print(make_icon(os.path.join(OUT, "icon.png")))
    print(make_cover(os.path.join(OUT, "cover.png")))
