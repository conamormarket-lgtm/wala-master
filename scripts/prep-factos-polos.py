"""
Prepara las fotos de los polos Factos para scripts/seed-factos-polos.js.

Replica lo que hace el admin al subir (prepararSubida en
src/services/firebase/storage.js): principal en WebP con lado máximo 2000 px
y copias de 160/400/800 px de ancho, calidad 92 para PNG y 82 para JPG.
Se hace aquí porque sharp no está instalado para Windows en este repo.

Entrada:  C:\\Users\\Isaac\\Downloads\\factos\\<slug>_1.png (frente),
          <slug>_2.png (espalda), <slug>_3.jpg (campaña)
Salida:   C:\\Users\\Isaac\\Downloads\\factos\\webp\\<slug>\\{espalda,frente,campana}[_160|_400|_800].webp

USO: python scripts/prep-factos-polos.py
"""
import os
from PIL import Image

SRC = r'C:\Users\Isaac\Downloads\factos'
OUT = os.path.join(SRC, 'webp')
SLUGS = ['adicto', 'chola', 'negras', 'dedo', 'dificil', 'locus', 'moises', 'miguel', 'perro']
VISTAS = [('frente', '_1.png'), ('espalda', '_2.png'), ('campana', '_3.jpg')]
MAX_LADO = 2000
ANCHOS_VARIANTE = [160, 400, 800]

for slug in SLUGS:
    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    for vista, sufijo in VISTAS:
        src = os.path.join(SRC, slug + sufijo)
        calidad = 92 if sufijo.endswith('.png') else 82
        img = Image.open(src).convert('RGB')
        w, h = img.size
        escala = min(1, MAX_LADO / max(w, h))
        ancho_principal = round(w * escala)
        principal = img.resize((ancho_principal, round(h * escala)), Image.LANCZOS) if escala < 1 else img
        principal.save(os.path.join(OUT, slug, f'{vista}.webp'), 'WEBP', quality=calidad, method=6)
        for ancho in ANCHOS_VARIANTE:
            if ancho >= ancho_principal:
                continue
            img.resize((ancho, round(ancho * h / w)), Image.LANCZOS).save(
                os.path.join(OUT, slug, f'{vista}_{ancho}.webp'), 'WEBP', quality=calidad, method=6)
        print(f'OK {slug}/{vista} {w}x{h} -> {ancho_principal}px')
