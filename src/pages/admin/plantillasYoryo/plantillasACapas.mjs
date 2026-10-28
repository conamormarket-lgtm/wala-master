/**
 * Las plantillas de cuadros y mousepads del personalizador anterior (equipos
 * y parejas) pasadas a capas del estudio de Crear, para publicarlas como
 * diseños de la comunidad. Las posiciones de la plantilla son fracciones del
 * lienzo; en el estudio, unidades de la zona (UNIDADES_ZONA de ancho).
 *
 * Es una conversión de una sola vez (ver ImportarPlantillasYoryo.jsx): los
 * tamaños de letra se calculan aproximados y luego se ajustan en el estudio.
 */
// Las letras del personalizador anterior, con su par en el estudio y lo
// ancha que es cada letra (para que el texto de muestra quepa en su caja).
const FUENTES = {
  Elegante: { fuente: 'Cinzel', ancho: 0.72 },
  Clásica: { fuente: 'Montserrat', ancho: 0.6 },
  Fuerte: { fuente: 'Bebas Neue', ancho: 0.42 },
  Manuscrita: { fuente: 'Brush Script', ancho: 0.45 },
};

const ALINEACION = { izquierda: 'left', derecha: 'right', centro: 'center' };

// El fondo y la decoración (marco con ventanas) van fijos: el cliente no
// los mueve sin querer (ver "Editar el fondo y el marco" en el estudio).
const RECURSOS_FIJOS = new Set(['fondo', 'superposicion']);

let siguiente = 0;
const nuevoId = (base) => `capa_${base}_${Date.now().toString(36)}${(siguiente++).toString(36)}`;

/** Tamaño de letra (en unidades) para que `texto` entre en una caja de ancho × alto. */
export const tamanoParaCaja = (texto, ancho, alto, anchoLetra = 0.6) => {
  const lineas = String(texto || '').split('\n');
  const largo = Math.max(1, ...lineas.map((l) => l.length));
  return Math.max(12, Math.round(Math.min((alto * 0.9) / (lineas.length * 1.05), ancho / (largo * anchoLetra))));
};

/** Las palabras repartidas en `n` líneas de largo parejo. */
const enLineas = (texto, n) => {
  const palabras = texto.split(/\s+/);
  if (n <= 1 || palabras.length < n) return texto;
  const meta = texto.length / n;
  const lineas = [''];
  palabras.forEach((p) => {
    const actual = lineas[lineas.length - 1];
    if (actual && actual.length + p.length / 2 > meta && lineas.length < n) lineas.push(p);
    else lineas[lineas.length - 1] = actual ? `${actual} ${p}` : p;
  });
  return lineas.join('\n');
};

/** El texto en 1, 2 o 3 líneas, las que dejen la letra más grande en su caja. */
export const textoEnCaja = (texto, ancho, alto, anchoLetra) => [1, 2, 3]
  .map((n) => enLineas(texto, n))
  .reduce((mejor, t) => (tamanoParaCaja(t, ancho, alto, anchoLetra) > tamanoParaCaja(mejor, ancho, alto, anchoLetra) ? t : mejor));

/**
 * Capas del estudio para una plantilla.
 *  - preset: { elementos: [{ id, x, y, w, h, orden, recurso?, indiceFoto?, encaje?, fuente?, color?, ... }] }
 *  - proporcion: alto / ancho de la zona de la prenda de Crear
 *  - recursos: { [recurso]: { src, ancho, alto } } (las imágenes ya subidas)
 *  - foto: { src, ancho, alto } (la foto de muestra) · textos: { [id]: texto }
 *  - unidades: el ancho de la zona en unidades (UNIDADES_ZONA de utils/prendaBase.js)
 */
export function capasDePlantilla({ preset, proporcion, recursos, foto, textos, unidades }) {
  const altoZona = unidades * proporcion;
  const capas = [];
  [...(preset?.elementos || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)).forEach((e) => {
    const caja = { w: e.w * unidades, h: e.h * altoZona };
    const centro = { left: e.x * unidades, top: e.y * altoZona };
    const imagen = e.indiceFoto !== undefined ? foto : e.recurso ? recursos[e.recurso] : null;
    if (imagen) {
      // "completa" (o un recurso sin encaje) entra entero; el resto llena su caja.
      const llenar = e.encaje === 'cubrir' || (e.indiceFoto !== undefined && e.encaje !== 'completa');
      const escala = (llenar ? Math.max : Math.min)(caja.w / imagen.ancho, caja.h / imagen.alto);
      capas.push({
        id: nuevoId(e.id), type: 'image', src: imagen.src, anchoNatural: imagen.ancho, altoNatural: imagen.alto,
        escalaX: escala, escalaY: escala, angulo: 0, flipX: false, ...centro,
        ...(RECURSOS_FIJOS.has(e.recurso) && { fija: true }),
      });
      return;
    }
    const texto = textos[e.id];
    if (!texto) return;
    const letra = FUENTES[e.fuente] || FUENTES.Clásica;
    const escrito = textoEnCaja(e.mayusculas ? texto.toLocaleUpperCase('es') : texto, caja.w, caja.h, letra.ancho);
    const sombra = Number(e.sombraOpacidad) > 0.3;
    capas.push({
      id: nuevoId(e.id), type: 'text', text: escrito, fuente: letra.fuente,
      color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#111111',
      tamano: tamanoParaCaja(escrito, caja.w, caja.h, letra.ancho),
      negrita: false, cursiva: false, alineacion: ALINEACION[e.alineacion] || 'center',
      ...(Number(e.contornoAncho) > 0 && { contorno: 2, contornoColor: e.contornoColor || '#14294A' }),
      ...(sombra && { sombra: 3, sombraColor: e.sombraColor || '#000000' }),
      escalaX: 1, escalaY: 1, angulo: 0, ...centro,
    });
  });
  return capas;
}
