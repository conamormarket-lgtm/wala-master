import { RECURSOS_PAREJAS_YORYO } from './recursosParejas.mjs';

/*
 * Las plantillas de parejas del personalizador anterior: la decoración con
 * sus ventanas y los textos, en fracciones del lienzo.
 */

export function plantillaParejasBaseYoryo(modelo, producto = 'cuadro') {
  const recurso = RECURSOS_PAREJAS_YORYO[modelo];
  if (!recurso) return null;
  const proporcion = producto === 'mousepad' ? 195 / 235 : 250 / 310;
  const ratio = recurso.size[1] / recurso.size[0];
  const ew = Math.min(1, proporcion / ratio), eh = ew * ratio / proporcion;
  const ex = (1 - ew) / 2, ey = (1 - eh) / 2;
  const foto = (id, x, y, w, h, indiceFoto = 0) => ({ id, nombre: indiceFoto ? `Foto ${indiceFoto + 1}` : 'Foto', x, y, w, h, indiceFoto, orden: 1, margen: 0 });
  const texto = (id, nombre, x, y, w, h, fuente = 'Elegante', color = '#26342B') => ({ id, nombre, x, y, w, h, fuente, color, orden: 3, alineacion: 'centro', mayusculas: false });
  const elementos = modelo === 'botanico' ? [
    foto('foto', .29, .25, .43, .38), foto('foto2', .29, .635, .43, .37, 1), foto('foto3', .73, .435, .43, .76, 2),
    texto('nombre', 'Nombres', .5, .875, .68, .065), texto('fecha', 'Fecha', .5, .93, .4, .028, 'Clásica'), texto('frase', 'Dedicatoria', .5, .968, .7, .035, 'Manuscrita'),
  ] : modelo === 'floral' ? [
    foto('foto', .34, .5, .68, 1), texto('titulo', 'Título', .815, .32, .29, .13),
    texto('acento', 'Texto destacado', .815, .46, .29, .07, 'Manuscrita', '#BC6049'),
    texto('nombre', 'Nombres', .84, .65, .24, .075), texto('fecha', 'Fecha', .84, .73, .24, .035, 'Clásica'), texto('frase', 'Dedicatoria', .84, .87, .24, .11, 'Manuscrita'),
  ] : [foto('foto', .5, .36, 1, .72), texto('nombre', 'Nombres', .5, .835, .82, .085, 'Elegante', '#F2D399'), texto('frase', 'Dedicatoria', .5, .93, .80, .055, 'Manuscrita', '#F2D399')];
  return { clave: `${producto}__${modelo}__general`, producto, proporcion,
    recursos: { superposicion: recurso },
    elementos: [...elementos.map((e) => ({ ...e, x: ex + e.x * ew, y: ey + e.y * eh, w: e.w * ew, h: e.h * eh })),
      { id: 'decoracion', nombre: 'Decoración', recurso: 'superposicion', x: .5, y: .5, w: 1, h: 1, margen: 0, orden: 2 }],
  };
}
