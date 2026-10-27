"""Importa las tres decoraciones de parejas y las seis referencias deportivas."""
import json
import shutil
import sys
from pathlib import Path
from collections import deque
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
PAREJAS = {'dorado': 'Marco romántico_ ventana transparente y corazón dorado.png',
           'floral': 'Marco floral coral con foto transparente.png',
           'botanico': 'Collage botánico con tres ventanas transparentes.png'}
REFERENCIAS = {'real_madrid': '01-portada1.png', 'alianza_lima': '01-portada13.png',
               'barcelona': '01-portada2.png', 'sport_boys': '01-portada4.png',
               'sporting_cristall': '01-portada5.png', 'u': '01-portada6.png'}


def ventanas(imagen):
    imagen = imagen.copy()
    imagen.thumbnail((350, 350))
    w, h = imagen.size
    datos = bytearray(1 if v < 20 else 0 for v in imagen.getchannel('A').tobytes())
    componentes = []
    for inicio in range(w * h):
        if not datos[inicio]:
            continue
        cola = deque([inicio])
        datos[inicio] = 0
        xs, ys = [], []
        while cola:
            i = cola.popleft()
            x, y = i % w, i // w
            xs.append(x)
            ys.append(y)
            for j in (i - 1 if x else -1, i + 1 if x < w - 1 else -1,
                      i - w if y else -1, i + w if y < h - 1 else -1):
                if j >= 0 and datos[j]:
                    datos[j] = 0
                    cola.append(j)
        if len(xs) > 200:
            componentes.append({'area': len(xs), 'bbox': [min(xs) / w, min(ys) / h, (max(xs) + 1) / w, (max(ys) + 1) / h]})
    return sorted(componentes, key=lambda c: c['area'], reverse=True)


def preparar(origen):
    recursos = {}
    for modelo, nombre in PAREJAS.items():
        archivo = origen / nombre
        original = REPO / 'assets/yoryo-plantillas/parejas-originales' / nombre
        original.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archivo, original)
        with Image.open(archivo) as imagen:
            if imagen.mode != 'RGBA' or imagen.getchannel('A').getextrema()[0] != 0:
                raise ValueError(f'Falta transparencia real: {archivo}')
            destino = REPO / 'public/yoryo/capas/parejas' / modelo / '01_DECORACION.png'
            destino.parent.mkdir(parents=True, exist_ok=True)
            imagen.save(destino, optimize=True)
            recursos[modelo] = {'url': '/' + destino.relative_to(REPO / 'public').as_posix(),
                                'original': original.relative_to(REPO).as_posix(),
                                'size': list(imagen.size), 'alphaRange': list(imagen.getchannel('A').getextrema()),
                                'visible': [0, 0, 1, 1]}
            print(modelo, imagen.size, ventanas(imagen))
    referencias = {}
    for equipo, nombre in REFERENCIAS.items():
        destino = REPO / 'public/yoryo/referencias' / f'{equipo}.png'
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origen / nombre, destino)
        referencias[equipo] = '/' + destino.relative_to(REPO / 'public').as_posix()
    (REPO / 'src/utils/recursosParejasYoryo.mjs').write_text(
        '// Generado por scripts/preparar-parejas-yoryo.py.\nexport const RECURSOS_PAREJAS_YORYO = '
        + json.dumps(recursos, ensure_ascii=False, indent=2) + ';\nexport const REFERENCIAS_EQUIPOS_YORYO = '
        + json.dumps(referencias, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')


if __name__ == '__main__':
    preparar(Path(sys.argv[1]).resolve())
