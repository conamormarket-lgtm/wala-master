"""Normalización determinista: python scripts/preparar-capas-yoryo.py CARPETA_ORIGEN.

Requiere Pillow. Conserva los originales y solo usa el canal alfa para recortar.
"""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
EQUIPOS = {'alianza lima': 'alianza_lima', 'u': 'u', 'Sporting Cristal': 'sporting_cristall',
           'SportBoys': 'sport_boys', 'Barcelona': 'barcelona', 'Real Madrid': 'real_madrid'}


def preparar(origen):
    informe = {}
    for carpeta, equipo in EQUIPOS.items():
        destino = REPO / 'public/yoryo/capas/equipos' / equipo
        destino.mkdir(parents=True, exist_ok=True)
        informe[equipo] = {}
        for archivo in sorted((origen / carpeta).glob('*.png')):
            tipo = 'pincelada' if archivo.name.startswith('Pincelada') else 'escudo' if archivo.name.startswith(('Escudo', 'Emblema')) else 'fondo'
            original = REPO / 'assets/yoryo-plantillas/originales' / carpeta / archivo.name
            original.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(archivo, original)
            with Image.open(archivo) as fuente:
                tiene_alfa = 'A' in fuente.getbands()
                meta = {'original': str(original.relative_to(REPO)).replace('\\', '/'),
                        'originalSize': list(fuente.size), 'originalMode': fuente.mode,
                        'alphaRange': list(fuente.getchannel('A').getextrema()) if tiene_alfa else None}
                imagen = fuente.convert('RGBA')
            caja = imagen.getchannel('A').getbbox()
            if not caja:
                raise ValueError(f'Recurso vacío: {archivo}')
            if tipo != 'fondo' and (not tiene_alfa or meta['alphaRange'][0] != 0):
                raise ValueError(f'La capa no tiene transparencia real: {archivo}')
            if tipo == 'escudo':
                contenido = imagen.crop(caja)
                contenido.thumbnail((940, 1340), Image.Resampling.LANCZOS)
                imagen = Image.new('RGBA', (1000, 1400))
                # Paste sin máscara: conserva el alfa original, sin multiplicarlo.
                imagen.paste(contenido, ((1000 - contenido.width) // 2, (1400 - contenido.height) // 2))
            elif tipo == 'pincelada':
                # Expande el lienzo si la tinta llega a un borde del original.
                contenido = imagen.crop(caja)
                imagen = Image.new('RGBA', (contenido.width + 24, contenido.height + 24))
                imagen.paste(contenido, (12, 12))
            nombre = {'fondo': '01_FONDO.png', 'escudo': '02_ESCUDO.png', 'pincelada': '03_PINCELADA.png'}[tipo]
            imagen.save(destino / nombre, optimize=True)
            visible = imagen.getchannel('A').getbbox()
            meta.update({'url': f'/yoryo/capas/equipos/{equipo}/{nombre}', 'size': list(imagen.size),
                         'visible': [visible[0] / imagen.width, visible[1] / imagen.height,
                                     (visible[2] - visible[0]) / imagen.width, (visible[3] - visible[1]) / imagen.height]})
            informe[equipo][tipo] = meta
        if set(informe[equipo]) != {'fondo', 'escudo', 'pincelada'}:
            raise ValueError(f'Faltan capas para {carpeta}')
    salida = REPO / 'src/utils/recursosCapasYoryo.mjs'
    salida.write_text('// Generado por scripts/preparar-capas-yoryo.py. No ampliar fondos para simular detalle.\n'
                      + 'export const RECURSOS_CAPAS_YORYO = ' + json.dumps(informe, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print('18 recursos preparados. Originales conservados en assets/yoryo-plantillas/originales.')


if __name__ == '__main__':
    preparar(Path(sys.argv[1]).resolve())
