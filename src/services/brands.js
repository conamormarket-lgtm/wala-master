import { getCollection, getDocument, createDocument, updateDocument, deleteDocument, setDocument } from './firebase/firestore';
// Defaults canónicos de cada tipo de sección (los mismos que usa el Editor
// Visual). Se importan para que la plantilla de página de marca no duplique
// decenas de campos ni se quede desfasada cuando cambien esos defaults.
import { getDefaultSettings } from '../pages/Tienda/services/storefront';
import { BLOQUES_MARCA } from '../componentes/kit/adaptadores';

const COLLECTION = 'tienda_brands';

/**
 * Genera el "slug canónico" de la marca a partir de un texto (normalmente el name):
 * minúsculas, sin acentos, sin espacios ni símbolos (solo a-z0-9).
 * Ej: 'Con Amor' → 'conamor', 'MUEBLERÍA' → 'muebleria'.
 * Debe quedar consistente con el slugify() del Header para que la detección de
 * página de marca coincida con lo que aquí se persiste.
 */
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, tildes, diéresis)
    .replace(/[^a-z0-9]+/g, '');     // quita espacios, guiones y cualquier símbolo

/**
 * Obtener todas las marcas ordenadas por order
 */
export const getBrands = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

/**
 * Obtener una marca por ID
 */
export const getBrand = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Normaliza el array `categoryNav` de una marca.
 * Cada item es una "burbuja" con foto + label: { categoryId, name, imageUrl, order }.
 * - categoryId puede referenciar una categoría de tienda_categories o ser libre.
 * - Se descartan items no válidos y se garantiza el tipo de cada campo.
 */
const normalizeCategoryNav = (categoryNav) => {
  if (!Array.isArray(categoryNav)) return [];
  return categoryNav
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => ({
      categoryId: item.categoryId || '',
      name: item.name || '',
      imageUrl: item.imageUrl || '',
      order: typeof item.order === 'number' ? item.order : idx
    }));
};

/**
 * Normaliza la `identidad` de la página de una marca (la lee identidadDeMarca
 * del kit): { color, color2 } en hex de 6, estilo 'foto' | 'color' |
 * 'collage', imagen (URL de Storage), frase de una línea y los bloques de
 * BLOQUES_MARCA en su orden. Un campo vacío no se guarda (updateDocument quita
 * los '') y la página usa su valor por defecto. Los bloques nunca quedan
 * vacíos: una lista vacía tampoco se guardaría y la página volvería a
 * mostrarlos todos.
 */
const normalizeIdentidad = (identidad) => {
  const i = identidad && typeof identidad === 'object' ? identidad : {};
  const hex = (v) => {
    const t = String(v || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(t) ? t : '';
  };
  const bloques = Array.isArray(i.bloques) ? BLOQUES_MARCA.filter((b) => i.bloques.includes(b)) : [];
  return {
    color: hex(i.color),
    color2: hex(i.color2),
    estilo: ['foto', 'color', 'collage'].includes(i.estilo) ? i.estilo : 'color',
    imagen: String(i.imagen || '').trim(),
    frase: String(i.frase || '').replace(/\s+/g, ' ').trim(),
    bloques: bloques.length ? bloques : BLOQUES_MARCA
  };
};

/**
 * Normaliza el objeto `categoryNavStyle` de una marca (estilo del nav de categorías).
 * Controla cómo se PINTAN las burbujas en el storefront (sincronizado en todos lados):
 *  - align: alineación del contenedor → 'left' | 'center' | 'right' | 'justify'.
 *  - animation: modo de presentación → 'static' (fila/wrap, como hoy) | 'slider' (auto-scroll).
 * Default retrocompatible = { align: 'center', animation: 'static' } (= comportamiento actual).
 * Cualquier valor no válido cae al default.
 */
const VALID_ALIGN = ['left', 'center', 'right', 'justify'];
const VALID_ANIMATION = ['static', 'slider'];

const normalizeCategoryNavStyle = (style) => {
  const src = style && typeof style === 'object' ? style : {};
  return {
    align: VALID_ALIGN.includes(src.align) ? src.align : 'center',
    animation: VALID_ANIMATION.includes(src.animation) ? src.animation : 'static'
  };
};

/**
 * PLANTILLA DE PÁGINA DE MARCA
 * ────────────────────────────
 * Estructura calcada de la página de Con Amor Geeks (la que se tomó como
 * referencia), para que TODAS las marcas tengan la misma página y no una
 * "hoja suelta" con solo el catálogo:
 *
 *   0. hero_banner       → portada con el nombre de la marca
 *   1. categories_nav    → burbujas de categorías de ESA marca (categoryNav)
 *   2. featured_carousel → "Productos Destacados"
 *   3. sale_carousel     → "Ofertas"
 *   4. sidebar_catalog   → catálogo con filtros, acotado a la marca
 *   5. marquee           → las demás marcas de Walá (solo si hay logos)
 *
 * Los carruseles NO necesitan brandId: TiendaPage deriva `pageBrandId` del
 * catálogo/nav y con eso acota destacados, ofertas y categorías. Por eso el
 * catálogo y el nav sí lo llevan.
 *
 * Todo lo que no es propio de la marca sale de getDefaultSettings(type), para
 * que la plantilla no se quede vieja si cambian los defaults del editor.
 */
const buildBrandLandingSections = (brandId, name, opts = {}) => {
  const { slug = '', heroImageUrl = '', marqueeItems = [] } = opts;
  const brandName = String(name || '').trim();
  const tiendaLink = slug ? `/${slug}` : '/tienda';

  const sections = [
    {
      id: 'sec_hero',
      type: 'hero_banner',
      order: 0,
      settings: {
        ...getDefaultSettings('hero_banner'),
        // Imagen de fondo de la marca si la tiene; si no, la de por defecto
        // (mejor un hero genérico que uno vacío en negro).
        mediaUrl: heroImageUrl || getDefaultSettings('hero_banner').mediaUrl,
        title: (brandName || 'Nuestra Tienda').toLocaleUpperCase('es-PE'),
        subtitle: brandName ? `Productos de ${brandName}` : 'Explora nuestros productos.',
        buttonText: 'COMPRAR AHORA',
        buttonLink: tiendaLink
      }
    },
    {
      id: 'sec_nav',
      type: 'categories_nav',
      order: 1,
      settings: { ...getDefaultSettings('categories_nav'), brandId }
    },
    {
      id: 'sec_destacados',
      type: 'featured_carousel',
      order: 2,
      settings: { ...getDefaultSettings('featured_carousel'), title: 'Productos Destacados' }
    },
    {
      id: 'sec_ofertas',
      type: 'sale_carousel',
      order: 3,
      settings: { ...getDefaultSettings('sale_carousel'), title: 'Ofertas' }
    },
    {
      id: 'sec_catalog',
      type: 'sidebar_catalog',
      order: 4,
      settings: {
        ...getDefaultSettings('sidebar_catalog'),
        title: brandName ? `Productos ${brandName}` : 'Catálogo',
        brandId
      }
    }
  ];

  // El marquee solo se agrega si hay otras marcas CON logo: BrandMarquee no
  // pinta nada sin items, y una sección vacía guardada solo estorba al editar.
  if (marqueeItems.length > 0) {
    sections.push({
      id: 'sec_marcas',
      type: 'marquee',
      order: 5,
      settings: { ...getDefaultSettings('marquee'), items: marqueeItems }
    });
  }

  return sections;
};

/**
 * Items del marquee "Empresas con las que trabajamos": el resto de marcas de
 * Walá (con logo), enlazando cada una a su propia página /<slug>. Se excluye la
 * marca dueña de la página — no tiene sentido que se enlace a sí misma.
 */
const buildBrandMarqueeItems = (brands, excludeBrandId) =>
  (Array.isArray(brands) ? brands : [])
    .filter((b) => b && b.id !== excludeBrandId && b.logoUrl && b.active !== false && b.visible !== false)
    .map((b) => {
      const s = b.slug ? slugify(b.slug) : slugify(b.name);
      return { imageUrl: b.logoUrl, name: b.name || '', link: s ? `/${s}` : '' };
    });

/**
 * ¿Se puede regenerar esta página sin pedir permiso? Solo si NO tiene trabajo
 * propio encima. Se acepta por dos vías:
 *
 * 1. Pares id→tipo que genera este mismo archivo (isAutoGeneratedLayout). Cubre
 *    las páginas recién creadas por la plantilla, para que repetir el backfill
 *    sea idempotente y las mejoras de la plantilla se propaguen.
 *
 * 2. Página MÍNIMA de marca (isMinimalBrandLayout): sus secciones son solo
 *    encabezado / nav de categorías / catrálogo. Es la página "en bruto" que
 *    dejaba el generador anterior. Se mira el TIPO y no el id porque a muchas de
 *    esas páginas se les agregó el nav a mano desde el Editor Visual, y con ids
 *    generados por el editor (section_...) nunca habrían entrado por la vía 1:
 *    se quedaban para siempre con encabezado + catálogo.
 *
 * En cuanto la página tiene UNA sola sección de contenido propio (hero,
 * carruseles, banners, texto, imagen…) deja de ser mínima y se conserva.
 * Es lo que protege a una página ya diseñada como la de Con Amor Geeks.
 *
 * OJO: mira la ESTRUCTURA, no el contenido. Si a una página mínima solo le
 * cambiaron textos o colores, la plantilla igual la reescribe.
 */
const AUTO_LAYOUT_TYPES = {
  // layout viejo (encabezado + catálogo)
  sec_header: 'header',
  // layout de esta plantilla
  sec_hero: 'hero_banner',
  sec_nav: 'categories_nav',
  sec_destacados: 'featured_carousel',
  sec_ofertas: 'sale_carousel',
  sec_catalog: 'sidebar_catalog',
  sec_marcas: 'marquee'
};

const isAutoGeneratedLayout = (sections) =>
  Array.isArray(sections) &&
  sections.length > 0 &&
  sections.every((sec) => sec && AUTO_LAYOUT_TYPES[sec.id] === sec.type);

// Tipos que puede tener una página de marca "en bruto": listar productos y poco
// más. Ninguno aporta contenido diseñado, así que rehacerla no pierde trabajo.
const MINIMAL_BRAND_TYPES = new Set(['header', 'categories_nav', 'sidebar_catalog', 'product_grid']);

const isMinimalBrandLayout = (sections) =>
  Array.isArray(sections) &&
  sections.length > 0 &&
  sections.every((sec) => sec && MINIMAL_BRAND_TYPES.has(sec.type));

const puedeRegenerarse = (sections) =>
  isAutoGeneratedLayout(sections) || isMinimalBrandLayout(sections);

/**
 * Garantiza que exista la PÁGINA DE MARCA (landing + layout) para que
 * WALA.PE/<slug> muestre la marca con la MISMA estructura que las demás
 * (hero, nav de categorías, destacados, ofertas, catálogo y marquee —
 * ver buildBrandLandingSections). Idempotente:
 *  - landingPages/{slug}: crea { slug, brandId } si la marca aún no tiene
 *    landing. Si ya tiene una (bajo cualquier slug, p.ej. uno capitalizado
 *    como 'ConAmor') se reutiliza ESA y no se crea otra.
 *  - pages/{slug}: escribe la plantilla si la página no existe, si está
 *    vacía, o si lo que hay es una plantilla automática anterior (el layout
 *    viejo de "encabezado + catálogo"). Una página EDITADA A MANO en el
 *    Editor Visual NO se toca salvo que se pida `force`.
 * No lanza: ante un error solo lo registra (crear la marca no debe fallar por esto).
 *
 * @param {string} brandId
 * @param {string} slug
 * @param {string} name
 * @param {{ force?: boolean, brand?: object, allBrands?: Array }} [opts]
 *   force    → reescribe el layout aunque esté editado a mano.
 *   brand    → doc de la marca ya cargado (evita releerlo); de ahí sale la
 *              imagen del hero (bgImage).
 *   allBrands→ lista de marcas ya cargada, para armar el marquee sin releer
 *              la colección en cada marca del backfill.
 * @returns {{ error:(string|null), landingCreada:boolean, layout:('creado'|'actualizado'|'al-dia'|'conservado') }}
 */
export const ensureBrandLanding = async (brandId, slug, name, opts = {}) => {
  try {
    if (!brandId || !slug) return { error: 'brandId y slug son requeridos' };
    const { force = false, brand = null, allBrands = null } = opts;

    // Anti-DUPLICADOS: si la marca YA tiene una landing (bajo cualquier slug),
    // se trabaja sobre ESA — no se crea una segunda. brandId es único por marca,
    // así que la capitalización del slug existente da igual.
    const { data: existentes } = await getCollection('landingPages', [
      { field: 'brandId', operator: '==', value: brandId }
    ]);
    const landingPrevia = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;
    // El layout vive en pages/{slug de la landing} (así lo lee DynamicLandingPage):
    // si la landing ya existía con otro slug, hay que escribir la página de ESE
    // slug y no la de uno nuevo. El id no sirve: puede ser 'lp_…' o un slug viejo.
    const pageId = landingPrevia ? (landingPrevia.slug || landingPrevia.id || slug) : slug;

    if (!landingPrevia) {
      // Landing: el eslabón que resuelve /<slug> → marca (vía DynamicLandingPage).
      await setDocument('landingPages', slug, { slug, brandId, title: name || slug });
    }

    // Layout. Se respeta lo editado a mano salvo force.
    const existing = await getDocument('pages', pageId);
    const previas = existing?.data?.sections;
    const tieneSecciones = Array.isArray(previas) && previas.length > 0;
    const esAuto = puedeRegenerarse(previas);

    if (tieneSecciones && !esAuto && !force) {
      return { error: null, landingCreada: !landingPrevia, layout: 'conservado' };
    }

    // Datos de marca para personalizar la plantilla. Solo se leen si hacen falta.
    let brandDoc = brand;
    if (!brandDoc) {
      const { data } = await getDocument(COLLECTION, brandId);
      brandDoc = data || null;
    }
    let marcas = allBrands;
    if (!marcas) {
      const { data } = await getBrands();
      marcas = data || [];
    }

    const nuevas = buildBrandLandingSections(brandId, name, {
      slug: pageId,
      heroImageUrl: brandDoc?.bgImage || '',
      marqueeItems: buildBrandMarqueeItems(marcas, brandId)
    });

    // Si la página ya es exactamente esta plantilla, no se reescribe: repetir el
    // backfill no debe gastar escrituras ni reportar cambios que no ocurrieron.
    if (tieneSecciones && JSON.stringify(previas) === JSON.stringify(nuevas)) {
      return { error: null, landingCreada: !landingPrevia, layout: 'al-dia' };
    }

    await setDocument('pages', pageId, { sections: nuevas });

    return {
      error: null,
      landingCreada: !landingPrevia,
      layout: tieneSecciones ? 'actualizado' : 'creado'
    };
  } catch (error) {
    console.warn('[brands] ensureBrandLanding:', error?.message || error);
    return { error: error?.message || String(error) };
  }
};

/**
 * Backfill: aplica la plantilla de página de marca (hero + nav + destacados +
 * ofertas + catálogo + marquee) a TODAS las marcas, para que ninguna quede con
 * una página distinta a las demás. Pensado para un botón en el admin (usa la
 * sesión del administrador; no requiere Cloud Shell ni credenciales).
 *
 * Idempotente y no destructivo por defecto: las páginas EDITADAS A MANO en el
 * Editor Visual se conservan y se informan aparte, para que el admin decida.
 * Con `force` se reescriben también esas.
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {{ total:number, creadas:number, actualizadas:number, alDia:number, conservadas:number, sinSlug:number, conservadasNombres:string[], error:(string|null) }}
 */
export const ensureAllBrandLandings = async (opts = {}) => {
  const { force = false } = opts;
  const { data: brands, error } = await getBrands();
  if (error) return { total: 0, creadas: 0, actualizadas: 0, alDia: 0, conservadas: 0, sinSlug: 0, conservadasNombres: [], error };
  const marcas = brands || [];
  let creadas = 0;
  let actualizadas = 0;
  let alDia = 0;
  let conservadas = 0;
  let sinSlug = 0;
  const conservadasNombres = [];
  for (const b of marcas) {
    const slug = b.slug ? slugify(b.slug) : slugify(b.name);
    if (!slug) { sinSlug++; continue; }
    // Se pasan `brand` y `allBrands` ya cargados: si no, cada marca releería
    // su doc y la colección entera solo para armar el hero y el marquee.
    const res = await ensureBrandLanding(b.id, slug, b.name || '', { force, brand: b, allBrands: marcas });
    if (res?.layout === 'creado') creadas++;
    else if (res?.layout === 'actualizado') actualizadas++;
    else if (res?.layout === 'al-dia') alDia++;
    else if (res?.layout === 'conservado') { conservadas++; conservadasNombres.push(b.name || slug); }
  }
  return { total: marcas.length, creadas, actualizadas, alDia, conservadas, sinSlug, conservadasNombres, error: null };
};

/**
 * Limpieza: elimina landings DUPLICADAS de una misma marca, conservando la
 * canónica. Útil para deshacer duplicados creados por un backfill previo
 * (ej. /ConAmor + /conamor apuntando al mismo brandId).
 *
 * Duplicadas = misma marca y la MISMA URL salvo mayúsculas y símbolos
 * (/ConAmor, /conamor, /con-amor). Una landing de campaña con la marca y otra
 * URL (/geeks-navidad) no es un duplicado: antes se borraba con su diseño.
 *
 * Canónica, en este orden: la que tiene un diseño editado a mano (no la
 * plantilla automática), la que coincide EXACTO con el `slug` de la marca, la
 * primera. De cada duplicada se borra la landing y su diseño (pages/<slug>), y
 * su URL queda en slugsAnteriores de la canónica: sus links redirigen.
 * No toca marcas ni productos.
 * @returns {{ eliminadas:number, error:(string|null) }}
 */
export const dedupeBrandLandings = async () => {
  try {
    const [{ data: landings, error: e1 }, { data: brands, error: e2 }] = await Promise.all([
      getCollection('landingPages'),
      getBrands(),
    ]);
    if (e1 || e2) return { eliminadas: 0, error: e1 || e2 };

    const brandById = new Map((brands || []).map((b) => [b.id, b]));
    const grupos = new Map();
    for (const lp of (landings || [])) {
      if (!lp.brandId) continue; // solo landings ligadas a una marca
      const clave = `${lp.brandId}/${slugify(lp.slug || lp.id)}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(lp);
    }

    let eliminadas = 0;
    for (const list of grupos.values()) {
      if (list.length <= 1) continue; // no hay duplicados
      const brandSlug = brandById.get(list[0].brandId)?.slug || '';
      const editadas = new Set();
      for (const l of list) {
        const { data } = await getDocument('pages', l.slug || l.id);
        const secciones = data?.sections;
        if (Array.isArray(secciones) && secciones.length > 0 && !puedeRegenerarse(secciones)) editadas.add(l.id);
      }
      const canonical = list.find((l) => editadas.has(l.id))
        || list.find((l) => (l.slug || l.id) === brandSlug)
        || list[0];
      const urlCanonica = canonical.slug || canonical.id;
      const anteriores = new Set(canonical.slugsAnteriores || []);
      for (const l of list) {
        if (l.id === canonical.id) continue;
        const url = l.slug || l.id;
        await deleteDocument('landingPages', l.id);
        // Su diseño vive en pages/<slug>; si es otro doc que el de la canónica, se va con ella.
        if (url !== urlCanonica) await deleteDocument('pages', url);
        if (l.id !== url && l.id !== urlCanonica) await deleteDocument('pages', l.id);
        [url, ...(l.slugsAnteriores || [])].forEach((x) => { if (x && x !== urlCanonica) anteriores.add(x); });
        eliminadas++;
      }
      if (anteriores.size) await updateDocument('landingPages', canonical.id, { slugsAnteriores: [...anteriores] });
    }
    return { eliminadas, error: null };
  } catch (error) {
    console.warn('[brands] dedupeBrandLandings:', error?.message || error);
    return { eliminadas: 0, error: error?.message || String(error) };
  }
};

/**
 * Crear marca (Firestore genera ID)
 * @param {{ name: string, slug?: string, logoUrl?: string, order: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string }, storeTitle?: string, storeSubtitle?: string, storeEmpty?: string, identidad?: { color?: string, color2?: string, estilo?: string, imagen?: string, frase?: string, bloques?: string[] } }} data
 */
export const createBrand = async (data) => {
  // Slug de primera clase: si viene explícito se respeta (normalizado); si no, se
  // deriva del name. createBrand SIEMPRE deja un slug para que la marca sea
  // detectable como página /<slug> desde el Header.
  const slug = slugify(data.slug) || slugify(data.name);
  const result = await createDocument(COLLECTION, {
    name: data.name || '',
    slug,
    logoUrl: data.logoUrl || '',
    order: typeof data.order === 'number' ? data.order : 0,
    bgColor: data.bgColor || '#ffffff',
    bgImage: data.bgImage || '',
    bgOpacity: typeof data.bgOpacity === 'number' ? data.bgOpacity : 100,
    whatsappNumber: data.whatsappNumber || '',
    // Nav de categorías por marca (burbujas con miniatura). Vacío por defecto.
    categoryNav: normalizeCategoryNav(data.categoryNav),
    // Estilo del nav de categorías (alineación + modo estático/slider). Default centrado/estático.
    categoryNavStyle: normalizeCategoryNavStyle(data.categoryNavStyle),
    // Mensajes de tienda propios de la marca (opcionales). Vacío = usa el global
    // (ver TiendaPage: storeTitle/storeSubtitle/storeEmpty con fallback al mensaje
    // global de la colección 'messages').
    storeTitle: data.storeTitle || '',
    storeSubtitle: data.storeSubtitle || '',
    storeEmpty: data.storeEmpty || '',
    // Identidad de su página (color, portada, frase y bloques). Solo si viene.
    ...(data.identidad !== undefined && { identidad: normalizeIdentidad(data.identidad) })
  });

  // Auto-crear su página de marca con la plantilla COMPLETA (hero, nav de
  // categorías, destacados, ofertas, catálogo y marquee) para que WALA.PE/<slug>
  // nazca igual que las demás marcas, sin pasos manuales. Se le pasa el doc de
  // la marca recién creada para que el hero use su imagen de fondo.
  // Si falla, la marca igual queda creada.
  if (result?.id && slug) {
    await ensureBrandLanding(result.id, slug, data.name || '', {
      brand: { bgImage: data.bgImage || '', logoUrl: data.logoUrl || '' }
    });
  }

  return result;
};

/**
 * La URL de la marca cambió (su slug): su página se va con ella. Antes solo
 * cambiaba tienda_brands.slug y la landing seguía en el slug viejo: el menú
 * Marcas y los mosaicos llevaban a /<nuevo> ("No encontramos esta página")
 * mientras /<viejo> seguía abriendo.
 *  - La landing de la marca es la que tiene su slug de antes (sin mirar
 *    mayúsculas) o, si no, la única que tiene. Las de campaña con la misma
 *    marca no se tocan.
 *  - Su diseño (pages/<slug>) se copia al nuevo; el viejo queda de respaldo.
 *  - El slug viejo queda en slugsAnteriores: los links compartidos redirigen.
 *  - Si la marca no tenía landing, se arma como al crearla.
 * Si otra landing ya usa la URL nueva, no se hace nada y se avisa.
 * @returns {{ error:(string|null) }}
 */
const moverLandingDeMarca = async (brandId, slugViejo, slugNuevo, name) => {
  const minus = (v) => String(v || '').toLowerCase();
  const { data: todas, error } = await getCollection('landingPages');
  if (error) return { error };
  const landings = todas || [];
  const ocupada = landings.find((l) => l.brandId !== brandId && minus(l.slug || l.id) === minus(slugNuevo));
  if (ocupada) return { error: `La URL /${slugNuevo} ya es de otra página ("${ocupada.title || ocupada.slug || ocupada.id}"). Elige otra.` };

  const deLaMarca = landings.filter((l) => l.brandId === brandId);
  const landing = deLaMarca.find((l) => minus(l.slug || l.id) === minus(slugViejo)) || (deLaMarca.length === 1 ? deLaMarca[0] : null);
  if (!landing) {
    if (deLaMarca.length > 1) return { error: 'La marca tiene varias páginas y ninguna con su URL de antes: cambia la URL en Landing Pages.' };
    const r = await ensureBrandLanding(brandId, slugNuevo, name);
    return { error: r?.error || null };
  }
  const actual = landing.slug || landing.id;
  if (minus(actual) === minus(slugNuevo)) return { error: null };
  if (deLaMarca.some((l) => l.id !== landing.id && minus(l.slug || l.id) === minus(slugNuevo))) {
    return { error: `La marca ya tiene otra página en /${slugNuevo}: cámbiala en Landing Pages.` };
  }

  const { data: diseno } = await getDocument('pages', actual);
  if (diseno) {
    const { id: _id, updatedAt: _fecha, ...secciones } = diseno;
    const { error: errorDiseno } = await setDocument('pages', slugNuevo, secciones);
    if (errorDiseno) return { error: `No se pudo mover el diseño de la página: ${errorDiseno}` };
  }
  const slugsAnteriores = [...new Set([...(landing.slugsAnteriores || []), actual])].filter((x) => minus(x) !== minus(slugNuevo));
  const { error: errorLanding } = await updateDocument('landingPages', landing.id, { slug: slugNuevo, slugsAnteriores });
  return { error: errorLanding || null };
};

/**
 * Actualizar marca
 * @param {string} id
 * @param {{ name?: string, slug?: string, logoUrl?: string, order?: number, bgColor?: string, bgImage?: string, bgOpacity?: number, categoryNav?: Array, categoryNavStyle?: { align?: string, animation?: string }, storeTitle?: string, storeSubtitle?: string, storeEmpty?: string, identidad?: { color?: string, color2?: string, estilo?: string, imagen?: string, frase?: string, bloques?: string[] } }} data
 */
export const updateBrand = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  // Slug: se persiste si se pasa explícito (normalizado, derivado del name si queda
  // vacío) o si NO se pasa pero sí viene el name (para rellenar marcas que aún no
  // tienen slug). Si no llega ni slug ni name, no se toca (aditivo/retrocompatible).
  if (data.slug !== undefined) {
    payload.slug = slugify(data.slug) || slugify(data.name);
  } else if (data.name !== undefined) {
    payload.slug = slugify(data.name);
  }
  if (data.logoUrl !== undefined) payload.logoUrl = data.logoUrl;
  if (data.order !== undefined) payload.order = data.order;
  if (data.bgColor !== undefined) payload.bgColor = data.bgColor;
  if (data.bgImage !== undefined) payload.bgImage = data.bgImage;
  if (data.bgOpacity !== undefined) payload.bgOpacity = data.bgOpacity;
  if (data.whatsappNumber !== undefined) payload.whatsappNumber = data.whatsappNumber;
  // Persistir el nav de categorías de la marca (aditivo: solo si viene en data).
  if (data.categoryNav !== undefined) payload.categoryNav = normalizeCategoryNav(data.categoryNav);
  // Persistir el estilo del nav (aditivo: solo se escribe si viene en data).
  if (data.categoryNavStyle !== undefined) payload.categoryNavStyle = normalizeCategoryNavStyle(data.categoryNavStyle);
  // Mensajes de tienda por marca (aditivo: solo se escriben si vienen en data).
  if (data.storeTitle !== undefined) payload.storeTitle = data.storeTitle;
  if (data.storeSubtitle !== undefined) payload.storeSubtitle = data.storeSubtitle;
  if (data.storeEmpty !== undefined) payload.storeEmpty = data.storeEmpty;
  // Identidad de la página de la marca: el mapa entero se reescribe.
  if (data.identidad !== undefined) payload.identidad = normalizeIdentidad(data.identidad);
  // Cambió la URL: primero la página (si no se puede, la marca no cambia).
  if (payload.slug !== undefined) {
    const { data: previa } = await getDocument(COLLECTION, id);
    const slugViejo = previa ? (previa.slug ? slugify(previa.slug) : slugify(previa.name)) : '';
    if (slugViejo && payload.slug && slugViejo !== payload.slug) {
      const { error } = await moverLandingDeMarca(id, slugViejo, payload.slug, payload.name ?? previa.name ?? '');
      if (error) return { error };
    }
  }
  return await updateDocument(COLLECTION, id, payload);
};

/**
 * Eliminar marca Y su página.
 *
 * Antes solo borraba el doc de `tienda_brands`, y la página de la marca quedaba
 * huérfana: WALA.PE/<slug> seguía abriendo (la landing existía) pero con un
 * brandId muerto, o sea el hero con el nombre de una marca que ya no está y el
 * catálogo vacío. Ahora se limpia todo el rastro:
 *   - landingPages/{id}: el eslabón URL → marca. Sin él, /<slug> deja de
 *     resolver y DynamicLandingPage redirige al inicio.
 *   - pages/{id}: el layout de esa página.
 *
 * Se buscan las landings por `brandId` y no por slug: así se limpian también las
 * que quedaron bajo otro slug (p.ej. uno capitalizado) y no hace falta que el
 * campo `slug` de la marca esté al día.
 *
 * La marca se borra AUNQUE falle la limpieza — es lo que el admin pidió —, pero
 * el error se devuelve en `paginasError` para poder avisarlo.
 *
 * NO toca los productos: conservan su `brandId` (igual que antes) y solo pierden
 * el fondo propio de la marca.
 *
 * @returns {{ error:(string|null), paginasEliminadas:number, paginasError:(string|null) }}
 */
export const deleteBrand = async (id) => {
  let paginasEliminadas = 0;
  let paginasError = null;
  try {
    const { data: landings, error } = await getCollection('landingPages', [
      { field: 'brandId', operator: '==', value: id }
    ]);
    if (error) throw new Error(error);
    for (const lp of (landings || [])) {
      await deleteDocument('landingPages', lp.id);
      await deleteDocument('pages', lp.id);
      paginasEliminadas++;
    }
  } catch (e) {
    paginasError = e?.message || String(e);
    console.warn('[brands] deleteBrand (limpieza de páginas):', paginasError);
  }
  const { error } = await deleteDocument(COLLECTION, id);
  return { error: error || null, paginasEliminadas, paginasError };
};
