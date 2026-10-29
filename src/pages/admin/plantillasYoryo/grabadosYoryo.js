import { createProduct, getProduct, getProducts, updateProductField } from '../../../services/products';
import { uploadFile } from '../../../services/firebase/storage';
import { getDocument } from '../../../services/firebase/firestore';
import { getCombosCrear, guardarComboCrear } from '../../../services/combosCrear';
import { leerPrendaBase, UNIDADES_ZONA } from '../../../utils/prendaBase';
import { miniaturaDePlantilla, subirAProducto, guardarPlantillasDelProducto, fotoDeTiendaConPlantilla } from '../../Crear/plantillasProducto';
import { tamanoParaCaja } from './plantillasACapas.mjs';

/*
 * Una sola vez (29-10-2026): la billetera Cónsul y la esclava de Yoryo grabadas
 * con láser, como productos de Crear con sus plantillas (iniciales o nombre con
 * un símbolo o una fecha), los 3 combos de reloj + billetera + esclava como
 * packs de Crear con el reloj tal cual, y "Personalizar" de la tienda llevando
 * a ellos. Los de la tienda se siguen vendiendo sin grabar, al mismo precio.
 * Corre con la sesión del admin, desde ImportarPlantillasYoryo.
 *
 * Las fotos para diseñar están en public/yoryo/grabados/: las transparentes
 * que mandó el dueño (la cara lisa de cada color y la esclava de frente, con
 * la placa recta), recortadas al producto. Las zonas se midieron sobre ellas. Las medidas en cm son ESTIMADAS (el taller todavía no las
 * confirmó): se corrigen en la ficha, pestaña Diseño, con la línea de
 * referencia.
 */

const BASE = '/yoryo/grabados';
// Qué fotos para diseñar lleva el producto: si cambian, volver a correrlo las
// pone (con sus zonas) en el producto que ya existe.
const VERSION_FOTOS = 'transparentes-2026-10-29';
const BILLETERA_TIENDA = 'NEtavILSA0EoxJgGD7ou';
const ESCLAVA_TIENDA = 'WAxcEpXkgODfj0JBc4qB';
export const IDS_GRABADOS = { billetera: 'yoryo-crear-billetera', esclava: 'yoryo-crear-esclava' };

// Plateado sobre el cuero; oscuro sobre el acero (como en las fotos de muestra).
const TINTA = { billetera: '#D9D9D9', esclava: '#262626' };
const LETRA = 'Crimson Pro';
const ESCRITA = 'Back to Black';

const PIEZAS = {
  billetera: {
    id: IDS_GRABADOS.billetera, tiendaId: BILLETERA_TIENDA, nombre: 'Billetera Yoryo Cónsul grabada',
    vista: { id: 'frente', nombre: 'Cara lisa' },
    // Por color: su foto para diseñar y la del frente con cierre (la portada).
    fotos: {
      'Deep Blue': { diseno: 'billetera-deep-blue.webp', cierre: 'billetera-deep-blue-cierre.webp' },
      'Marrón Coñac': { diseno: 'billetera-marron-conac.webp', cierre: 'billetera-marron-conac-cierre.webp' },
      'Negro Azabache': { diseno: 'billetera-negro-azabache.webp', cierre: 'billetera-negro-azabache-cierre.webp' },
    },
    // La tarjeta de Crear la muestra de frente (con el cierre); se graba atrás.
    portadaDeFrente: true,
    // Sobre la foto de 989 × 1224 (la cara va de 45,45 a 944,1179; las de los
    // otros colores tienen el mismo encuadre): abajo a la derecha, como en las
    // fotos de muestra. Cara de unos 9 cm de ancho (estimado).
    zona: { id: 'billetera-grabado', nombre: 'Grabado', x: 566 / 989, y: 848 / 1224, w: 306 / 989, proporcion: 0.75, angulo: 0 },
    referencia: { x1: 45 / 989, y1: 600 / 1224, x2: 944 / 989, y2: 600 / 1224, cm: 9 },
  },
  esclava: {
    id: IDS_GRABADOS.esclava, tiendaId: ESCLAVA_TIENDA, nombre: 'Esclava Yoryo grabada',
    vista: { id: 'frente', nombre: 'Placa' },
    fotos: { 'Negro Acero': { diseno: 'esclava-negro-acero.webp' } },
    // Sobre la foto de 1024 × 768: la placa va de x 238 a 790 y de y 370 a 540;
    // la zona queda adentro, sin tocar el borde. Placa de unos 4.5 cm (estimado).
    zona: { id: 'esclava-placa', nombre: 'Placa', x: 268 / 1024, y: 390 / 768, w: 492 / 1024, proporcion: 130 / 492, angulo: 0 },
    referencia: { x1: 238 / 1024, y1: 455 / 768, x2: 790 / 1024, y2: 455 / 768, cm: 4.5 },
  },
};

// Los símbolos de las fotos de muestra, con un ejemplo de iniciales y de nombre.
const SIMBOLOS = [
  ['flecha', 'flecha', 'T. A.', 'THIAGO'],
  ['infinito', 'infinito', 'L. M.', 'LEONARDO'],
  ['estrella', 'estrella', 'E. R.', 'EMILIANO'],
  ['corazon', 'corazón', 'J. L.', 'JOAQUÍN'],
  ['rayo', 'rayo', 'D. S.', 'DIEGO'],
  ['montana', 'montaña', 'L. A.', 'LUCAS'],
];

let siguiente = 0;
const nuevoId = (base) => `capa_${base}_${Date.now().toString(36)}${(siguiente++).toString(36)}`;

/** Una capa de texto centrada en (x, y), con la letra más grande que entre en su caja. */
const texto = (base, text, { x, y, w, h }, { fuente = LETRA, color, negrita = true, anchoLetra = 0.66 }) => ({
  id: nuevoId(base), type: 'text', text, fuente, color,
  tamano: tamanoParaCaja(text, w, h, anchoLetra),
  negrita, cursiva: false, alineacion: 'center', escalaX: 1, escalaY: 1, angulo: 0, left: x, top: y,
  // Un nombre más largo achica la letra para que siga en su caja.
  anchoMax: Math.round(w),
});

/** El símbolo (una imagen ya subida) centrado en (x, y) y entero en su caja. */
const simbolo = (recurso, { x, y, w, h }) => {
  const escala = Math.min(w / recurso.ancho, h / recurso.alto);
  return {
    id: nuevoId('simbolo'), type: 'image', src: recurso.src, anchoNatural: recurso.ancho, altoNatural: recurso.alto,
    escalaX: escala, escalaY: escala, angulo: 0, flipX: false, left: x, top: y, fija: true,
  };
};

/**
 * Las plantillas de una pieza: con cada símbolo, con fecha, solo el texto y en
 * letra escrita. En la billetera van las iniciales; en la esclava, el nombre.
 * Posiciones en unidades de la zona (UNIDADES_ZONA de ancho).
 */
function plantillasDe(clave, proporcion, simbolos) {
  const W = UNIDADES_ZONA;
  const H = W * proporcion;
  const color = TINTA[clave];
  const billetera = clave === 'billetera';
  const que = billetera ? 'Iniciales' : 'Nombre';
  // La caja del texto principal y la de lo de abajo (símbolo o fecha).
  const arriba = billetera ? { x: W / 2, y: H * 0.38, w: W * 0.88, h: H * 0.48 } : { x: W / 2, y: H * 0.32, w: W * 0.94, h: H * 0.54 };
  const abajo = billetera ? { x: W / 2, y: H * 0.79, w: W * 0.4, h: H * 0.28 } : { x: W / 2, y: H * 0.79, w: W * 0.34, h: H * 0.38 };
  const fecha = billetera ? { x: W / 2, y: H * 0.78, w: W * 0.86, h: H * 0.19 } : { x: W / 2, y: H * 0.79, w: W * 0.7, h: H * 0.32 };
  const sola = { x: W / 2, y: H / 2, w: W * 0.92, h: H * (billetera ? 0.7 : 0.84) };
  const anchoLetra = billetera ? 0.62 : 0.68;
  return [
    ...SIMBOLOS.map(([id, nombre, iniciales, nombrePersona]) => ({
      id: `grabado-${clave}-${id}`, nombre: `${que} con ${nombre}`, grupo: 'Con símbolo',
      capas: [texto('texto', billetera ? iniciales : nombrePersona, arriba, { color, anchoLetra }), simbolo(simbolos[id], abajo)],
    })),
    {
      id: `grabado-${clave}-fecha`, nombre: `${que} con fecha`, grupo: 'Con fecha',
      capas: [
        texto('texto', billetera ? 'A. C.' : 'ANDRÉS', arriba, { color, anchoLetra }),
        texto('fecha', '14.02.2026', fecha, { color, negrita: false, anchoLetra: 0.56 }),
      ],
    },
    {
      id: `grabado-${clave}-solo`, nombre: billetera ? 'Solo iniciales' : 'Solo el nombre', grupo: 'Solo texto',
      capas: [texto('texto', billetera ? 'M. R.' : 'MATEO', sola, { color, anchoLetra })],
    },
    {
      id: `grabado-${clave}-escrita`, nombre: 'Nombre en letra escrita', grupo: 'Solo texto',
      capas: [texto('texto', billetera ? 'Mateo' : 'Thiago', sola, { fuente: ESCRITA, color, negrita: false, anchoLetra: 0.82 })],
    },
  ];
}

const leerBlob = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se encontró ${url}`);
  return r.blob();
};

const medidas = async (blob) => {
  const b = await createImageBitmap(blob);
  const m = { ancho: b.width, alto: b.height };
  b.close?.();
  return m;
};

const subir = async (prendaId, blob, nombre) => {
  const extension = blob.type === 'image/webp' ? 'webp' : 'png';
  const archivo = new File([blob], `${nombre}.${extension}`, { type: blob.type || 'image/png' });
  const { url, error } = await uploadFile(archivo, `productos_v2/${prendaId}/crear_${Date.now()}_${nombre}.${extension}`);
  if (error || !url) throw new Error(error || `No se pudo subir ${nombre}.`);
  return url;
};

/** Un símbolo SVG en el color del grabado, a 600 px de alto. */
async function simboloEnColor(nombre, color) {
  const url = URL.createObjectURL(await leerBlob(`${BASE}/simbolos/${nombre}.svg`));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`No se pudo leer el símbolo ${nombre}.`));
      i.src = url;
    });
    const alto = 600;
    const ancho = Math.round((alto * (img.naturalWidth || 1)) / (img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, ancho, alto);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, ancho, alto);
    const blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar el símbolo.'))), 'image/png'));
    return { blob, ancho, alto };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const mismoColor = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Sube la foto para diseñar de cada color. Devuelve { colores, principal }. */
async function subirFotosDeDiseno(clave, pieza, tienda) {
  const colores = {};
  let principal = null;
  for (const v of tienda.variants || []) {
    const fotos = Object.entries(pieza.fotos).find(([nombre]) => mismoColor(nombre, v.name))?.[1];
    if (!fotos) throw new Error(`Falta la foto para diseñar de ${pieza.nombre} en ${v.name}.`);
    const blob = await leerBlob(`${BASE}/${fotos.diseno}`);
    const url = await subir(pieza.id, blob, `${clave}-${v.id}`);
    colores[v.id] = { fotos: { [pieza.vista.id]: url } };
    if (!principal || String(v.id) === String(tienda.defaultVariantId)) principal = { url, ...(await medidas(blob)) };
  }
  return { colores, principal };
}

/**
 * Crea la pieza en Crear si falta (id fijo): fotos por color, vista, zona y
 * referencia. Si ya existe con otras fotos para diseñar (VERSION_FOTOS), las
 * cambia con sus zonas y conserva los cm que haya puesto el admin.
 */
async function crearPieza(clave, pieza, tienda, onPaso) {
  const existe = await getDocument('productos_wala', pieza.id);
  if (existe.data && existe.data.deleted !== true) {
    const pb = existe.data.prendaBase || {};
    if (pb.versionFotos === VERSION_FOTOS) {
      onPaso(`${pieza.nombre}: ya existía`);
      return;
    }
    onPaso(`${pieza.nombre}: cambiando las fotos para diseñar…`);
    const { colores, principal } = await subirFotosDeDiseno(clave, pieza, tienda);
    const v0 = pb.vistas?.[0] || {};
    const cm = Number(v0.referencia?.cm) || pieza.referencia.cm;
    await updateProductField(pieza.id, {
      prendaBase: {
        ...pb,
        vistas: [{
          ...v0, ...pieza.vista, imagen: principal.url, anchoImg: principal.ancho, altoImg: principal.alto,
          referencia: { ...pieza.referencia, cm }, zonas: [pieza.zona],
        }, ...(pb.vistas || []).slice(1)],
        colores: Object.fromEntries(Object.entries(colores).map(([vid, c]) => [vid, { ...(pb.colores?.[vid] || {}), ...c }])),
        ...(pieza.portadaDeFrente && { portadaTienda: true }),
        versionFotos: VERSION_FOTOS,
      },
    });
    return;
  }
  onPaso(`${pieza.nombre}: subiendo las fotos…`);
  const { colores, principal } = await subirFotosDeDiseno(clave, pieza, tienda);
  const variantes = (tienda.variants || []).map((v) => ({ id: v.id, name: v.name, colorHex: v.colorHex, imageUrl: '', images: [], sizes: [] }));
  onPaso(`${pieza.nombre}: creando…`);
  await createProduct({
    name: pieza.nombre,
    description: tienda.description || '',
    price: tienda.price,
    salePrice: tienda.salePrice || 0,
    inStock: null,
    brandId: tienda.brandId || '',
    categories: tienda.categories || [],
    mainImage: '',
    hasVariants: true,
    variants: variantes,
    defaultVariantId: tienda.defaultVariantId || variantes[0]?.id || '',
    esPrendaBase: true,
    visible: true,
    isV2: true,
    prendaBase: {
      tipo: 'producto',
      tecnica: 'laser',
      soloPlantillas: true,
      ...(pieza.portadaDeFrente && { portadaTienda: true }),
      versionFotos: VERSION_FOTOS,
      vistas: [{
        ...pieza.vista, imagen: principal.url, anchoImg: principal.ancho, altoImg: principal.alto,
        referencia: pieza.referencia, zonas: [pieza.zona],
      }],
      colores,
    },
  }, pieza.id);
}

/**
 * Las plantillas (por id: volver a guardarlas reemplaza las mismas) y, en cada
 * color, la foto de la tarjeta con la primera plantilla grabada y la galería
 * (el frente con cierre y las fotos de la tienda de ese color).
 */
async function plantillasYFotos(clave, pieza, tienda, onPaso) {
  const { data } = await getDocument('productos_wala', pieza.id);
  const cfg = leerPrendaBase(data);
  const vista = cfg.vistas[0];
  const zona = vista.zonas[0];
  const color = cfg.colores.find((c) => String(c.id) === String(data.defaultVariantId)) || cfg.colores[0];
  onPaso(`${pieza.nombre}: preparando los símbolos…`);
  const simbolos = {};
  for (const [id] of SIMBOLOS) {
    const { blob, ancho, alto } = await simboloEnColor(id, TINTA[clave]);
    simbolos[id] = { src: await subirAProducto(pieza.id, blob, `simbolo-${id}`), ancho, alto };
  }
  const lista = plantillasDe(clave, zona.proporcion, simbolos);
  const hechas = [];
  for (const [i, p] of lista.entries()) {
    onPaso(`${pieza.nombre}: plantilla ${i + 1} de ${lista.length}…`);
    const capas = { [zona.id]: p.capas };
    const miniatura = await miniaturaDePlantilla({ vista, zona, color, capas, laser: true });
    hechas.push({ id: p.id, nombre: p.nombre, grupo: p.grupo, imagen: await subirAProducto(pieza.id, miniatura, 'miniatura'), capas });
  }
  await guardarPlantillasDelProducto(pieza.id, hechas);

  // La foto de tienda de cada color: grabada con la primera plantilla o, en
  // la billetera, de frente (su portada en Crear) con la grabada en la galería.
  onPaso(`${pieza.nombre}: fotos de cada color…`);
  const variants = [];
  for (const v of data.variants || []) {
    const c = cfg.colores.find((x) => String(x.id) === String(v.id));
    const deTienda = (tienda.variants || []).find((x) => String(x.id) === String(v.id));
    const grabada = c ? await fotoDeTiendaConPlantilla({ prendaId: pieza.id, cfg: { vistas: cfg.vistas, laser: true }, color: c, plantilla: hechas[0] }) : v.imageUrl;
    const cierre = Object.entries(pieza.fotos).find(([nombre]) => mismoColor(nombre, v.name))?.[1]?.cierre;
    const urlCierre = cierre ? await subir(pieza.id, await leerBlob(`${BASE}/${cierre}`), `${clave}-${v.id}-cierre`) : '';
    // Las de la tienda sin su frente con cierre (lo pone galeriaDeTienda): no se repite al volver a correrlo.
    const deLaTienda = (deTienda?.images || []).filter((u) => !String(u).includes('-cierre'));
    const deFrente = pieza.portadaDeFrente && urlCierre;
    variants.push({
      ...v,
      imageUrl: deFrente ? urlCierre : grabada,
      images: (deFrente ? [grabada, ...deLaTienda] : [urlCierre, ...deLaTienda]).filter(Boolean),
      cierre: urlCierre,
    });
  }
  await updateProductField(pieza.id, { variants: variants.map(({ cierre: _cierre, ...v }) => v) });
  return { cfg, variants };
}

/**
 * El frente con cierre también en la galería de la billetera de la tienda (si
 * no está). Se lee el documento tal cual: lo normalizado no trae todos los
 * campos de las variantes y se perderían al guardarlas.
 */
async function galeriaDeTienda(tiendaId, variants) {
  const { data: tienda } = await getDocument('productos_wala', tiendaId);
  if (!tienda) return;
  const conCierre = (tienda.variants || []).map((v) => {
    const cierre = variants.find((x) => String(x.id) === String(v.id))?.cierre;
    if (!cierre || (v.images || []).some((u) => String(u).includes('-cierre'))) return v;
    return { ...v, images: [...(v.images || []), cierre], galleryImages: [...(v.galleryImages || v.images || []), cierre] };
  });
  await updateProductField(tiendaId, { variants: conCierre });
}

const firmaPack = (piezas) => piezas.map((p) => `${p.prendaId}${p.fija ? `:${p.color?.nombre}` : ''}`).join('|');

/**
 * Los packs de Crear de los combos de la tienda que llevan la billetera y la
 * esclava: el reloj del combo tal cual, en su color, y las dos grabadas (la
 * billetera abre en el color del combo). Mismo precio que el combo.
 */
async function packsDeCombos(prendas, onPaso) {
  const { data: combos } = await getCombosCrear({ incluirBorradores: true });
  const { data: productos } = await getProducts([], null, null, { includeHidden: true });
  const delCombo = (productos || []).filter((p) => p.isComboProduct && p.deleted !== true && p.brandId === prendas.billetera.brandId
    && (p.comboItems || []).some((i) => i.productId === BILLETERA_TIENDA) && (p.comboItems || []).some((i) => i.productId === ESCLAVA_TIENDA));
  const hechos = [];
  for (const combo of delCombo) {
    const items = combo.comboItems || [];
    const piezas = [];
    for (const item of items) {
      const color = item.variantMapping?.color || '';
      if (item.productId === BILLETERA_TIENDA || item.productId === ESCLAVA_TIENDA) {
        const prenda = item.productId === BILLETERA_TIENDA ? prendas.billetera : prendas.esclava;
        const v = (prenda.variants || []).find((x) => mismoColor(x.name, color));
        piezas.push({
          prendaId: prenda.id, nombre: prenda.name, imagen: v?.imageUrl || prenda.variants?.[0]?.imageUrl || '',
          ...(v && { color: { id: String(v.id), nombre: v.name, hex: v.colorHex || '' } }),
        });
        continue;
      }
      const { data: producto } = await getProduct(item.productId);
      const v = (producto?.variants || []).find((x) => mismoColor(x.name, color)) || producto?.variants?.[0];
      if (!producto || !v) throw new Error(`No encontré ${item.name || 'una pieza'} de "${combo.name}".`);
      piezas.push({
        prendaId: producto.id, fija: true, nombre: producto.name, imagen: v.imageUrl || producto.mainImage || '',
        color: { id: String(v.id), nombre: v.name, hex: v.colorHex || '' },
      });
    }
    const nombre = `${String(combo.name || '').replace(/^Esclava GRATIS · /i, '')} grabado`;
    let pack = (combos || []).find((c) => c.deleted !== true && firmaPack(c.piezas || []) === firmaPack(piezas))?.id;
    if (pack) onPaso(`${nombre}: ya existía`);
    else {
      onPaso(`${nombre}: creando…`);
      pack = await guardarComboCrear(null, {
        name: nombre,
        description: 'Reloj, billetera y esclava. La billetera lleva tus iniciales y la esclava un nombre, grabados con láser. La esclava va gratis.',
        price: combo.price,
        salePrice: combo.salePrice || 0,
        mainImage: combo.comboPreviewImage || combo.mainImage || '',
        brandId: combo.brandId || '',
        categories: combo.categories || [],
        publicado: true,
        enTienda: false,
        piezas,
        tallas: 'auto',
      });
    }
    await updateProductField(combo.id, { personalizarEn: `/combo/${pack}` });
    hechos.push({ combo: combo.name, pack });
  }
  return hechos;
}

/**
 * Todo de una vez (lo que ya existe no se repite; las plantillas y las fotos
 * se rehacen): la billetera y la esclava en Crear con sus plantillas, la
 * esclava de la tienda a la vista, "Personalizar" de las dos y de los combos
 * llevando a Crear, y los packs. Devuelve { billetera, esclava, packs }.
 */
export async function crearGrabadosYoryo({ onPaso = () => {} } = {}) {
  const prendas = {};
  for (const [clave, pieza] of Object.entries(PIEZAS)) {
    const { data: tienda } = await getProduct(pieza.tiendaId);
    if (!tienda) throw new Error(`No encontré ${pieza.nombre.replace(' grabada', '')} en la tienda.`);
    await crearPieza(clave, pieza, tienda, onPaso);
    const { variants } = await plantillasYFotos(clave, pieza, tienda, onPaso);
    if (clave === 'billetera') await galeriaDeTienda(pieza.tiendaId, variants);
    await updateProductField(pieza.tiendaId, {
      personalizarEn: `/crear/${pieza.id}`,
      // La esclava se vendía solo en los combos: ahora también sola.
      ...(clave === 'esclava' && {
        visible: true,
        description: '<p>Esclava de cuero trenzado negro con placa de acero pulido.</p><p>¿La quieres con un nombre? Tócala en <strong>Personalizar</strong> y grábasela, al mismo precio.</p>',
      }),
    });
    prendas[clave] = (await getProduct(pieza.id)).data;
    onPaso(`${pieza.nombre}: lista`);
  }
  const packs = await packsDeCombos(prendas, onPaso);
  onPaso(`Listo: billetera y esclava grabadas, y ${packs.length} ${packs.length === 1 ? 'pack' : 'packs'} con el reloj tal cual.`);
  return { ...IDS_GRABADOS, packs };
}
