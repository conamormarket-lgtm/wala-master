import { getDocument } from '../../../services/firebase/firestore';
import { getDesignsByUser, eliminarCreacion } from '../../../services/designs';
import { retirarDeComunidad } from '../../../services/comunidad';
import { subirAProducto, miniaturaDePlantilla, guardarPlantillasDelProducto } from '../../Crear/plantillasProducto';
import { leerPrendaBase, colorDisponible, UNIDADES_ZONA, slug } from '../../../utils/prendaBase';
import { capasDePlantilla } from './plantillasACapas.mjs';
import { IDS_CREAR_YORYO } from './crearProductosYoryo';
import { plantillaCapasBaseYoryo, plantillaTomatodoYoryo } from './presetsEquipos.mjs';
import { plantillaParejasBaseYoryo } from './presetsParejas.mjs';

/*
 * Los pasos 2 y 3 de "Plantillas de cuadros", fuera de la pantalla: las
 * plantillas de Yoryo de cada producto, guardarlas en el producto (con su
 * miniatura y sus imágenes subidas a su carpeta) y quitar las copias que la
 * versión anterior publicó en la comunidad. Sin React: los usan la pantalla
 * de antes (ImportarPlantillasYoryo) y el conector del kit
 * (components/panel/PlantillasYoryoDelPanel), cada uno con sus avisos.
 */

// Los textos de muestra son los de las portadas de referencia de cada plantilla.
const DEDICATORIA = 'Para el mejor papá. Con amor, Sofía.';
const EQUIPOS = [
  ['Alianza Lima', 'Blanquiazul de corazón'], ['Universitario', 'Crema de corazón'], ['Sporting Cristal', 'Celeste de corazón'],
  ['Sport Boys', 'Rosado de corazón'], ['Barcelona', 'Culé de corazón'], ['Real Madrid', 'Madridista de corazón'],
];
const PAREJAS = [
  ['dorado', 'Banda dorada', { nombre: 'Andrea & Luis', frase: 'Gracias por caminar a mi lado.' }],
  ['floral', 'Mi lugar favorito', { titulo: 'Mi lugar favorito es', acento: 'contigo.', nombre: 'Diego & Valeria', fecha: '14.02.2022', frase: 'Gracias por hacerme sentir en casa.' }],
  ['botanico', 'Nuestra historia', { nombre: 'Camila & Andrés', fecha: '09.06.2023', frase: 'Por todos los recuerdos que nos faltan.' }],
];

/** Los productos de Crear que llevan plantillas: [clave, nombre]. */
export const PRODUCTOS = [['cuadro', 'Cuadro'], ['mousepad', 'Mousepad'], ['tomatodo', 'Tomatodo']];
const NOMBRES = new Set([...EQUIPOS.map(([e]) => e), ...PAREJAS.map(([, n]) => n)]);

/** Las plantillas de un producto: { id, producto, nombre, grupo, preset(), textos }. */
export const plantillasDe = (producto) => (producto === 'tomatodo'
  ? EQUIPOS.map(([equipo, frase]) => ({
    id: `yoryo-tomatodo-${slug(equipo)}`, producto, nombre: equipo, grupo: 'Equipos',
    preset: () => plantillaTomatodoYoryo(equipo), textos: { nombre: 'Daniel', frase },
  }))
  : [
    ...PAREJAS.map(([modelo, nombre, textos]) => ({
      id: `yoryo-${producto}-${modelo}`, producto, nombre, grupo: 'Parejas', preset: () => plantillaParejasBaseYoryo(modelo, producto), textos,
    })),
    ...EQUIPOS.map(([equipo, frase]) => ({
      id: `yoryo-${producto}-${slug(equipo)}`, producto, nombre: equipo, grupo: 'Equipos', preset: () => plantillaCapasBaseYoryo(equipo, producto),
      textos: { nombre: 'Daniel', frase, dedicatoria: DEDICATORIA },
    })),
  ]);

/** Las ediciones de la pantalla anterior (templates/yoryo-composiciones-v4): mandan sobre las de fábrica. */
export async function leerEditadas() {
  const r = await getDocument('templates', 'yoryo-composiciones-v4');
  return r.data?.presets || {};
}

const aBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));

/** "Tu foto": la foto de muestra que el cliente cambia con "Cambiar foto". */
async function fotoDeMuestra() {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#EDE7FB';
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = '#C4B5FD';
  ctx.beginPath();
  ctx.arc(600, 470, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(600, 1130, 420, 380, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#6D28D9';
  ctx.font = '900 110px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TU FOTO', 600, 830);
  return { blob: await aBlob(c), ancho: 1200, alto: 1200 };
}

/**
 * Un recurso de public/ como imagen de la plantilla. Un escudo para grabar
 * (SVG, `blanco`) se pinta en blanco a 1400 px de alto: así se ve plateado
 * sobre el tomatodo negro, como el grabado.
 */
async function prepararRecurso(r) {
  const res = await fetch(r.url);
  if (!res.ok) throw new Error(`No se encontró ${r.url}`);
  const blob = await res.blob();
  if (!r.blanco) {
    const bitmap = await createImageBitmap(blob);
    const medidas = { ancho: bitmap.width, alto: bitmap.height };
    bitmap.close?.();
    return { blob, ...medidas };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`No se pudo leer ${r.url}`));
      i.src = url;
    });
    const alto = 1400;
    const ancho = Math.round((alto * (img.naturalWidth || 1)) / (img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, ancho, alto);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ancho, alto);
    return { blob: await aBlob(c), ancho, alto };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Paso 2: guarda las plantillas elegidas en cada producto de destino.
 *  - destino: { cuadro: prendaId, … } ('' = no importar) · elegidas: ids (Set o lista)
 *  - prendas: las de getPrendasBase({ incluirBorradores: true }) · editadas: leerEditadas()
 *  - marcar(id, texto): 'Preparando…', 'Lista', 'Guardada en el producto' o 'Error: …'
 * No lanza: cada error queda en su plantilla.
 */
export async function importar({ destino, elegidas, prendas, editadas, marcar }) {
  const quiero = new Set(elegidas);
  const muestra = await fotoDeMuestra().catch(() => null);
  for (const [producto] of PRODUCTOS) {
    const prendaId = destino[producto];
    const lista = plantillasDe(producto).filter((x) => quiero.has(x.id));
    if (!prendaId || !lista.length) continue;
    try {
      const prenda = prendas.find((p) => p.id === prendaId);
      const leida = leerPrendaBase(prenda);
      const vista = leida.vistas[0];
      const zona = vista?.zonas[0];
      if (!zona) throw new Error('El producto no tiene una zona.');
      const color = leida.colores.find((c) => c.id === prenda.defaultVariantId && colorDisponible(c, leida.vistas)) || leida.colores[0];
      // Las imágenes se suben una vez por producto, a su carpeta de plantillas.
      const subidas = new Map();
      const recurso = (r) => {
        if (!subidas.has(r.url)) {
          subidas.set(r.url, prepararRecurso(r).then(async ({ blob, ancho, alto }) => ({ src: await subirAProducto(prendaId, blob, 'recurso'), ancho, alto })));
        }
        return subidas.get(r.url);
      };
      const foto = muestra && { src: await subirAProducto(prendaId, muestra.blob, 'tu-foto'), ancho: muestra.ancho, alto: muestra.alto };
      const hechas = [];
      for (const plantilla of lista) {
        try {
          marcar(plantilla.id, 'Preparando…');
          const base = plantilla.preset();
          const preset = editadas?.[base.clave] || base;
          const recursos = {};
          for (const [clave, r] of Object.entries(preset.recursos || {})) recursos[clave] = await recurso({ ...base.recursos?.[clave], ...r });
          const capas = { [zona.id]: capasDePlantilla({ preset, proporcion: zona.proporcion, recursos, foto, textos: plantilla.textos, unidades: UNIDADES_ZONA }) };
          const miniatura = await miniaturaDePlantilla({ vista, zona, color, capas, laser: leida.tecnica === 'laser' });
          hechas.push({ id: plantilla.id, nombre: plantilla.nombre, grupo: plantilla.grupo, imagen: await subirAProducto(prendaId, miniatura, 'miniatura'), capas });
          marcar(plantilla.id, 'Lista');
        } catch (e) {
          marcar(plantilla.id, `Error: ${e.message}`);
        }
      }
      if (hechas.length) {
        await guardarPlantillasDelProducto(prendaId, hechas);
        hechas.forEach((p) => marcar(p.id, 'Guardada en el producto'));
      }
    } catch (e) {
      lista.forEach((x) => marcar(x.id, `Error: ${e.message}`));
    }
  }
}

/**
 * Paso 3: las copias que la versión anterior de esta pantalla publicó en la
 * comunidad (y guardó en Mis creaciones de la cuenta `uid`): se retiran y se
 * borran. onPaso(texto) dice cómo va; devuelve el texto final. Si falla, lanza.
 */
export async function limpiar(uid, onPaso = () => {}) {
  onPaso('Buscando…');
  const ids = new Set(Object.values(IDS_CREAR_YORYO));
  const { data } = await getDesignsByUser(uid);
  const copias = (data || []).filter((d) => ids.has(d.productId) && NOMBRES.has(String(d.name || '').trim()));
  let hechas = 0;
  for (const d of copias) {
    onPaso(`Quitando ${hechas + 1} de ${copias.length}…`);
    // Si no estaba publicada, retirar no hace nada.
    await retirarDeComunidad(d.id);
    const { error } = await eliminarCreacion(uid, d);
    if (!error) hechas += 1;
  }
  return copias.length ? `Listo: se quitaron ${hechas} de ${copias.length}.` : 'No había copias.';
}
