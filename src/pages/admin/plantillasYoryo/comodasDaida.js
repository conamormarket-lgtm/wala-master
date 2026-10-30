import { createProduct, getProduct } from '../../../services/products';
import { getBrands } from '../../../services/brands';
import { getCategories, createCategory, updateCategory } from '../../../services/categories';
import { getProductTypes, createProductType } from '../../../services/productTypes';
import { uploadFile } from '../../../services/firebase/storage';

/*
 * Una sola vez (30-10-2026): las dos cómodas de Daida Hogar en la tienda, cada
 * una con sus tres colores (blanco, nogal y blanco, roble y blanco) y dos
 * fotos por color: en ángulo (la principal) y de frente. Crea lo que falte:
 * la categoría "Cómodas" de la marca y el tipo "Mueble". Lo que ya existe no
 * se repite. Los datos salen del catálogo de Daida (sus imágenes no se suben).
 * Corre con la sesión del admin, desde ImportarPlantillasYoryo. Las fotos
 * están en public/daida/ y se pueden borrar después de correrlo.
 */

const BASE = '/daida';
const CATEGORIA = 'Cómodas';
const TIPO = 'Mueble';

const COLORES = [
  { clave: 'blanco', nombre: 'Blanco', hex: '#F4F3EF' },
  { clave: 'nogal', nombre: 'Nogal y blanco', hex: '#5B3A24' },
  { clave: 'roble', nombre: 'Roble y blanco', hex: '#C9A673' },
];

const descripcion = ({ cajones, ancho, alto, fondo }) => (
  `<p>Cómoda de ${cajones} cajones en melamina de 18 mm, con rieles metálicos reforzados para que cada cajón abra y cierre suave. `
  + 'Un diseño estilo Pinterest que ordena tu día a día y combina con tu dormitorio.</p>'
  + `<p><strong>Medidas:</strong> ${ancho} cm de ancho, ${alto} cm de alto y ${fondo} cm de fondo.</p>`
  + '<p>Elige el color: blanco, nogal y blanco, o roble y blanco.</p>'
);

const PRODUCTOS = [
  {
    id: 'daida-comoda-4-cajones', foto: '4', name: 'Cómoda de 4 cajones', sku: 'DAI-COM-4C', price: 450,
    medidas: { cajones: 4, ancho: 80, alto: 100, fondo: 42 },
  },
  {
    id: 'daida-comoda-8-cajones', foto: '8', name: 'Cómoda de 8 cajones', sku: 'DAI-COM-8C', price: 590,
    medidas: { cajones: 8, ancho: 140, alto: 90, fondo: 42 },
  },
];
const STOCK = 4;
const ETIQUETAS = ['cómoda', 'cajones', 'dormitorio', 'muebles', 'melamina', 'organización'];

const normal = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Una foto de public/daida/ subida con sus copias chicas. uploadFile no hace
 * copias de un WebP (lo sube tal cual), así que se le pasa en PNG: él la
 * convierte a WebP y hace las de 160, 400 y 800 px, como con cualquier foto.
 */
async function subirFoto(productoId, nombre) {
  const r = await fetch(`${BASE}/${nombre}.webp`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`No se encontró la foto ${nombre}.`);
  const bitmap = await createImageBitmap(await r.blob());
  const lienzo = document.createElement('canvas');
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;
  lienzo.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const png = await new Promise((resolve, reject) => lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error(`No se pudo preparar ${nombre}.`))), 'image/png'));
  const archivo = new File([png], `${nombre}.png`, { type: 'image/png' });
  const { url, variantes, error } = await uploadFile(archivo, `productos_v2/${productoId}/${Date.now()}_${nombre}.png`);
  if (error || !url) throw new Error(error || `No se pudo subir ${nombre}.`);
  return { url, variantes: variantes || {} };
}

/** La marca Daida Hogar (ya creada en el admin). */
async function marcaDaida() {
  const { data } = await getBrands();
  const marca = (data || []).find((m) => normal(m.name).includes('daida') || normal(m.slug).includes('daida'));
  if (!marca) throw new Error('No encontré la marca Daida Hogar: créala en Admin → Marcas y vuelve a correrlo.');
  return marca;
}

/** La categoría "Cómodas" de la marca: la crea o le suma la marca. */
async function categoriaComodas(marcaId, imagen, onPaso) {
  const { data } = await getCategories();
  const lista = data || [];
  const existe = lista.find((c) => normal(c.name) === normal(CATEGORIA));
  if (existe) {
    const marcas = Array.isArray(existe.brandIds) ? existe.brandIds : [];
    if (!marcas.includes(marcaId)) await updateCategory(existe.id, { brandIds: [...marcas, marcaId] });
    if (!existe.imageUrl && imagen) await updateCategory(existe.id, { imageUrl: imagen });
    onPaso(`Categoría ${CATEGORIA}: ya existía`);
    return existe.id;
  }
  onPaso(`Categoría ${CATEGORIA}: creando…`);
  const orden = Math.max(0, ...lista.map((c) => Number(c.order) || 0)) + 1;
  const res = await createCategory({ name: CATEGORIA, imageUrl: imagen, order: orden, brandIds: [marcaId] });
  if (res.error || !res.id) throw new Error(res.error || 'No se pudo crear la categoría.');
  return res.id;
}

/** El tipo de producto "Mueble". */
async function tipoMueble(onPaso) {
  const { data } = await getProductTypes();
  const existe = (data || []).find((t) => normal(t.name) === normal(TIPO));
  if (existe) return existe.id;
  onPaso(`Tipo ${TIPO}: creando…`);
  const res = await createProductType({ name: TIPO });
  if (res.error || !res.id) throw new Error(res.error || 'No se pudo crear el tipo de producto.');
  return res.id;
}

/** Crea las dos cómodas (y lo que falte). Devuelve los ids de los productos. */
export async function crearComodasDaida({ onPaso = () => {} } = {}) {
  const marca = await marcaDaida();
  const productType = await tipoMueble(onPaso);
  let categoriaId = null;
  const hechos = [];
  for (const p of PRODUCTOS) {
    const { data: existe } = await getProduct(p.id);
    if (existe && existe.deleted !== true) {
      onPaso(`${p.name}: ya existía`);
      hechos.push(p.id);
      continue;
    }
    onPaso(`${p.name}: subiendo las fotos…`);
    const variants = [];
    for (const [i, c] of COLORES.entries()) {
      const principal = await subirFoto(p.id, `comoda-${p.foto}-${c.clave}`);
      const frente = await subirFoto(p.id, `comoda-${p.foto}-${c.clave}-frente`);
      variants.push({
        id: `var_${p.foto}c_${c.clave}`,
        name: c.nombre,
        colorHex: c.hex,
        imageUrl: principal.url,
        images: [frente.url],
        sizes: [],
        imagesVariantes: Object.fromEntries([[principal.url, principal.variantes], [frente.url, frente.variantes]]
          .filter(([, v]) => Object.keys(v).length)),
      });
      onPaso(`${p.name}: fotos ${i + 1} de ${COLORES.length}`);
    }
    if (!categoriaId) categoriaId = await categoriaComodas(marca.id, variants[0].imageUrl, onPaso);
    onPaso(`${p.name}: creando…`);
    const res = await createProduct({
      name: p.name,
      description: descripcion(p.medidas),
      price: p.price,
      salePrice: null,
      inStock: STOCK,
      sku: p.sku,
      brandId: marca.id,
      categories: [categoriaId],
      productType,
      tags: ETIQUETAS,
      fulfillmentType: 'stock',
      hasVariants: true,
      variants,
      defaultVariantId: variants[0].id,
      visible: true,
      isV2: true,
      customizable: false,
    }, p.id);
    if (res.error) throw new Error(res.error);
    hechos.push(p.id);
  }
  if (!categoriaId) await categoriaComodas(marca.id, '', onPaso);
  onPaso(`Listo: ${hechos.length} cómodas en ${marca.name}, categoría ${CATEGORIA}.`);
  return hechos;
}
