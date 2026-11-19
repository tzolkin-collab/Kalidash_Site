"""Gera a logo do Spectra AI em SVG: emblema (laços sobrepostos) + palavra "Spectra" + "AI".
Cada laço e cada letra são um <path> com id próprio, para animar (traço com pathLength=1, letras uma a uma).
Uso: python -I gerar.py <inter.woff2> <pasta-saida>"""
import math, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

fonte, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
f = instantiateVariableFont(TTFont(fonte), {"wght": 700})
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
UPM = f["head"].unitsPerEm

# ---- palavra: contornos da Inter Bold, tamanho de corpo 100, linha de base em y=0 ----
CORPO = 100
ESC = CORPO / UPM
TRACK = -0.022 * CORPO  # a logo do app é apertada


def letras(texto, x0):
    out, x = [], x0
    for ch in texto:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (ESC, 0, 0, -ESC, x, 0)))
        out.append((ch, pen.getCommands()))
        x += hmtx[g][0] * ESC + TRACK
    return out, x - TRACK


# ---- emblema: 6 laços elípticos girando em volta do centro (lembra o "espectro" e um olho/lente) ----
R = 58  # raio do selo
N = 5


def laco(i):
    # Pétala: círculo que passa perto do centro, girado 72° a cada laço. O traço começa no ponto mais perto do
    # centro, então ao animar as pétalas "brotam" do miolo. O pequeno desvio (0.86) deixa um redemoinho no meio.
    a = math.radians(i * 360 / N - 90)
    d, r = 0.34 * R, 0.40 * R
    cx, cy = d * math.cos(a), d * math.sin(a)
    t = a + math.pi + 0.55  # ponto de partida, um pouco fora do eixo: o miolo gira
    px, py = cx + r * math.cos(t), cy + r * math.sin(t)
    qx, qy = cx - r * math.cos(t), cy - r * math.sin(t)
    return f"M{px:.2f} {py:.2f}A{r:.2f} {r:.2f} 0 1 1 {qx:.2f} {qy:.2f}A{r:.2f} {r:.2f} 0 1 1 {px:.2f} {py:.2f}"


def emblema(cx, cy, tema):
    fundo = {"claro": "#f6f3ff", "escuro": "rgba(255,255,255,0.06)"}[tema]
    anel = {"claro": "#e9e3fb", "escuro": "rgba(196,166,115,0.35)"}[tema]
    s = [f'<g id="emblema" transform="translate({cx} {cy})">',
         f'<circle id="selo" r="{R}" fill="{fundo}" stroke="{anel}" stroke-width="1.5"/>',
         f'<g id="lacos" fill="none" stroke="url(#spectra-grad-{tema})" stroke-width="2.6" stroke-linecap="round">']
    for i in range(N):
        s.append(f'<path id="laco-{i + 1}" class="laco" pathLength="1" d="{laco(i)}"/>')
    s.append("</g></g>")
    return "\n".join(s)


GRAD = {
    "claro": ('#d7b6ee', '#7d6af0', '#4a2f9e'),
    "escuro": ('#efe2c6', '#c4a673', '#a88a58'),
}
CORES = {  # (Spectra, AI)
    "claro": ("#0d0a14", "#4a2f9e"),
    "escuro": ("#f4f1ea", "#c4a673"),
}


def svg(tema, com_palavra=True):
    g1, g2, g3 = GRAD[tema]
    defs = (f'<defs><linearGradient id="spectra-grad-{tema}" x1="-60" y1="-60" x2="60" y2="60" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{g1}"/><stop offset=".55" stop-color="{g2}"/><stop offset="1" stop-color="{g3}"/></linearGradient></defs>')
    if not com_palavra:
        w = 2 * R + 4
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {w}" role="img" aria-label="Spectra AI">'
                f'<title>Spectra AI</title>{defs}{emblema(w / 2, w / 2, tema)}</svg>')
    x_texto = 2 * R + 30
    sp, x = letras("Spectra", x_texto)
    ai, x = letras("AI", x + TRACK)
    largura = math.ceil(x + 4)
    altura = 2 * R + 4
    base = altura / 2 + 0.36 * CORPO  # centro óptico da altura de caixa alta (~0.727 em)
    c1, c2 = CORES[tema]
    partes = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largura} {altura}" role="img" aria-label="Spectra AI">',
              "<title>Spectra AI</title>", defs, emblema(R + 2, altura / 2, tema),
              f'<g id="palavra" transform="translate(0 {base:.2f})">',
              f'<g id="spectra" fill="{c1}">']
    partes += [f'<path id="l-{i + 1}" class="letra" data-letra="{ch}" d="{d}"/>' for i, (ch, d) in enumerate(sp)]
    partes.append(f'</g><g id="ai" fill="{c2}">')
    partes += [f'<path id="ai-{i + 1}" class="letra" data-letra="{ch}" d="{d}"/>' for i, (ch, d) in enumerate(ai)]
    partes.append("</g></g></svg>")
    return "\n".join(partes)


for nome, conteudo in {
    "spectra-logo.svg": svg("claro"),
    "spectra-logo-escuro.svg": svg("escuro"),
    "spectra-emblema.svg": svg("claro", False),
    "spectra-emblema-escuro.svg": svg("escuro", False),
}.items():
    with open(os.path.join(saida, nome), "w", encoding="utf8") as fh:
        fh.write(conteudo + "\n")
    print(nome, len(conteudo))
