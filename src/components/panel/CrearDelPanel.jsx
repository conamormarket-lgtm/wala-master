import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getPrendasBase, getPrendasBaseAdmin } from '../../services/prendasBase';
import { getCombosCrear, guardarComboCrear, archivarComboCrear, sugerirCombos } from '../../services/combosCrear';
import { getBrands } from '../../services/brands';
import { getCategories, getProducts, deleteProduct, updateProductField } from '../../services/products';
import { precioBase, leerPrendaBase } from '../../utils/prendaBase';
import { PaginaPersonalizables, PaginaPacks } from '../../componentes/kit/paginas/admin/Crear';
import {
  personalizableDesde, packDesdeFirestore, packAGuardar, marcaAdminDesdeFirestore, categoriaDesdeFirestore,
} from '../../componentes/kit/adaptadoresAdmin';
import { useLectura, useInvalidar, subirA } from './comun';

/*
 * Crear dentro de Productos (D2c): la pestaña "Personalizables" (?ver=crear)
 * y la de "Packs de Crear" (?ver=packs). Los dos van embebidos en
 * PaginaProductos (sus huecos `personalizables` y `packs`). Los mismos
 * servicios, claves e invalidaciones que AdminPrendasCrear y
 * AdminCombosCrear. La ficha de un personalizable no vive aquí: se abre en
 * /admin/prendas-crear/:id.
 */

const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });
const combosConBorradores = () => getCombosCrear({ incluirBorradores: true });
const prendasConBorradores = () => getPrendasBase({ incluirBorradores: true });
const subirPortada = subirA('productos_v2/combos_crear', 'portada');

/** Las claves de los combos: la del admin y las de la tienda (/crear y /combo/:id). */
const CLAVES_COMBOS = [['admin-combos-crear'], ['combos-crear'], ['combo-crear']];

/* ── Personalizables ───────────────────────────────────── */

/**
 * La lista de personalizables. Publicar cambia solo `visible`
 * (updateProductField) y archivar es el soft-delete de siempre (deleteProduct).
 *  - onAbrir(prenda): opcional; si no viene, abre su ficha en /admin/prendas-crear/:id
 */
export function PersonalizablesDelPanel({ onAbrir } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  // Al día cada vez que se abre (la caché de la app no vuelve a pedir sola).
  const prendas = useLectura(['admin-prendas-crear'], getPrendasBaseAdmin, { refetchOnMount: 'always' });
  // Solo para "En qué packs está": si falla, la lista se ve igual (como antes).
  const combos = useLectura(['admin-combos-crear'], combosConBorradores, { refetchOnMount: 'always' });

  const filas = useMemo(
    () => (prendas.datos || []).map((p) => personalizableDesde(p, combos.datos || [])),
    [prendas.datos, combos.datos],
  );

  // Como AdminPrendasCrear: las de Crear se releen aunque no estén a la vista
  // (refetchType 'all'). Además la lista de Productos y la tienda, porque un
  // personalizable con "También en la tienda" sale ahí.
  const refrescar = () => Promise.all([
    invalidar(['admin-prendas-crear'], ['admin-products'], ['products']),
    queryClient.invalidateQueries({ queryKey: ['prendas-base'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['prenda-base'], refetchType: 'all' }),
  ]);

  return (
    <PaginaPersonalizables
      embebido
      prendas={filas}
      cargando={prendas.cargando}
      error={prendas.error}
      onReintentar={() => { prendas.onReintentar(); combos.onReintentar(); }}
      onAbrir={onAbrir || ((p) => navigate(`/admin/prendas-crear/${p.id}`))}
      onVer={(p) => navigate(`/crear/${p.id}`)}
      urlNueva="/admin/prendas-crear/nueva"
      // updateProductField y deleteProduct ya lanzan si no se guardó.
      onPublicar={async (id, visible) => { await updateProductField(id, { visible }); await refrescar(); }}
      // A la papelera, recordando si estaba publicada (para restaurarla igual).
      onArchivar={async (id) => { await deleteProduct(id, { visibleAntes: (prendas.datos || []).find((p) => p.id === id)?.visible !== false }); await refrescar(); }}
    />
  );
}

/* ── Packs de Crear ────────────────────────────────────── */

// Un producto de la tienda que puede ir tal cual en un pack (pieza fija): con
// colores, ni prenda de Crear ni combo (el mismo filtro de AdminCombosCrear).
const sirveTalCual = (p) => p && p.deleted !== true && p.esPrendaBase !== true && !p.isComboProduct
  && p.esComboCrear !== true && (p.variants || []).length > 0;
const colorDeVariante = (v) => ({ id: String(v.id), nombre: v.name || '', hex: v.colorHex || '' });

// La foto de una prenda para la tarjeta del pack en la tienda: la de la
// tienda de su color principal o, si no tiene, la de su primera vista.
const fotoDePrenda = (prenda) => {
  const principal = (prenda?.variants || []).find((v) => String(v.id) === String(prenda.defaultVariantId)) || prenda?.variants?.[0];
  return principal?.imageUrl || leerPrendaBase(prenda).vistas[0]?.imagen || '';
};

// Lo que el kit necesita para elegir una pieza: { id, nombre, foto, precio, colores }.
// Los colores de una prenda de Crear son los del estudio (leerPrendaBase);
// los de un producto tal cual, sus variantes. Como antes, el nombre avisa si
// es un borrador o está oculto.
const opcionDePrenda = (p) => ({
  id: p.id,
  nombre: `${p.name || 'Sin nombre'}${p.visible === false ? ' (borrador)' : ''}`,
  foto: fotoDePrenda(p),
  precio: precioBase(p),
  colores: leerPrendaBase(p).colores.map((c) => ({ id: c.id, nombre: c.nombre, hex: c.hex || '' })),
});
const opcionTalCual = (p) => ({
  id: p.id,
  nombre: `${p.name || 'Sin nombre'}${p.visible === false ? ' (oculto)' : ''}`,
  foto: p.variants[0]?.imageUrl || p.mainImage || '',
  precio: precioBase(p),
  colores: p.variants.map(colorDeVariante),
});

/**
 * Los packs de Crear. Guardar pasa por packAGuardar y le pone a cada pieza el
 * nombre y la foto de su prenda (la tarjeta de la tienda los muestra sin leer
 * las prendas); "Sugerir packs" usa sugerirCombos y los crea uno por uno.
 *  - nuevoInicial: true abre "Nuevo pack" de una vez (Productos con
 *    ?ver=packs&nuevo=1, el "Nuevo → Pack de Crear"), como AdminCombosCrear
 */
export function PacksDelPanel({ nuevoInicial = false } = {}) {
  const navigate = useNavigate();
  const invalidar = useInvalidar();
  const combos = useLectura(['admin-combos-crear'], combosConBorradores);
  const prendas = useLectura(['prendas-base', true], prendasConBorradores);
  // Los productos de la tienda, para las piezas que van tal cual (la misma lista que Productos).
  const productos = useLectura(['admin-products'], productosConOcultos);
  const marcas = useLectura(['brands'], getBrands, { staleTime: 300_000 });
  const categorias = useLectura(['categories'], getCategories, { staleTime: 300_000 });

  const prendaPorId = useMemo(() => new Map((prendas.datos || []).map((p) => [p.id, p])), [prendas.datos]);
  const talCualPorId = useMemo(
    () => new Map((productos.datos || []).filter(sirveTalCual).map((p) => [p.id, p])),
    [productos.datos],
  );
  const opcionesPrendas = useMemo(() => (prendas.datos || []).map(opcionDePrenda), [prendas.datos]);
  const opcionesTalCual = useMemo(
    () => [...talCualPorId.values()].map(opcionTalCual).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [talCualPorId],
  );

  // Cada pieza con el nombre y la foto de su prenda (se actualizan cada vez
  // que se guarda el pack). La que va tal cual, con su color al día.
  const conFotos = (datos) => ({
    ...datos,
    piezas: (datos.piezas || []).map((p) => {
      if (p.fija) {
        const producto = talCualPorId.get(p.prendaId);
        const v = (producto?.variants || []).find((x) => String(x.id) === String(p.color?.id));
        return producto && v
          ? { prendaId: p.prendaId, fija: true, color: colorDeVariante(v), nombre: producto.name, imagen: v.imageUrl || producto.mainImage || '' }
          : p;
      }
      const prenda = prendaPorId.get(p.prendaId);
      return prenda ? { prendaId: p.prendaId, nombre: prenda.name, imagen: fotoDePrenda(prenda), ...(p.color && { color: p.color }) } : p;
    }),
  });

  const refrescar = () => invalidar(...CLAVES_COMBOS);
  const lecturas = [combos, prendas, productos, marcas, categorias];

  return (
    <PaginaPacks
      embebido
      packs={(combos.datos || []).map(packDesdeFirestore)}
      // Como antes, la lista espera solo a los packs; lo demás llega mientras.
      cargando={combos.cargando}
      error={combos.error || prendas.error}
      onReintentar={() => lecturas.forEach((l) => l.onReintentar())}
      prendas={opcionesPrendas}
      talCual={opcionesTalCual}
      marcas={(marcas.datos || []).map(marcaAdminDesdeFirestore)}
      categorias={(categorias.datos || []).map(categoriaDesdeFirestore)}
      subirImagen={subirPortada}
      nuevoInicial={nuevoInicial}
      onVer={(k) => navigate(`/combo/${k.id}`)}
      // guardarComboCrear y archivarComboCrear ya lanzan si no se guardó.
      onGuardar={async (datos, id) => {
        // El tipo del pack: el de su categoría (lo que la tienda filtra por «Tipo»).
        const cat = (categorias.datos || []).find((c) => c.id === datos.categoria);
        const pack = conFotos(packAGuardar(datos));
        // Publicado con una pieza en borrador, oculta o en la papelera, salía en la
        // tienda pero al abrirlo decía "no disponible" (y el servidor lo rechaza).
        if (pack.publicado) {
          const noSeVenden = (pack.piezas || []).filter((pz) => {
            const doc = pz.fija ? talCualPorId.get(pz.prendaId) : prendaPorId.get(pz.prendaId);
            return !doc || doc.deleted === true || doc.visible === false;
          });
          if (noSeVenden.length) {
            const nombres = [...new Set(noSeVenden.map((pz) => pz.nombre || 'una pieza'))].join(', ');
            throw new Error(`No se puede publicar: ${nombres} está en borrador, oculto o en la papelera. Publícalo primero o guarda el pack como borrador.`);
          }
        }
        await guardarComboCrear(id || null, { ...pack, productType: cat?.productType || '' });
        await refrescar();
      }}
      onArchivar={async (id) => { await archivarComboCrear(id, { publicadoAntes: (combos.datos || []).find((c) => c.id === id)?.publicado === true }); await refrescar(); }}
      // Pareja y trío de cada prenda publicada que aún no los tiene.
      onSugerir={() => sugerirCombos((prendas.datos || []).filter((p) => p.visible !== false), combos.datos || [], precioBase)
        .map((c) => ({ clave: c.clave, nombre: c.name, descripcion: c.description, precio: c.price, piezas: c.piezas, tallas: 'auto' }))}
      onCrearSugeridos={async (lista, publicar) => {
        if (lista.some((c) => !String(c.nombre || '').trim() || !(Number(c.precio) > 0))) {
          throw new Error('Cada pack elegido necesita su nombre y su precio.');
        }
        try {
          // Uno por uno: si uno falla, los anteriores ya quedaron creados.
          for (const c of lista) {
            await guardarComboCrear(null, conFotos({
              name: c.nombre,
              description: c.descripcion,
              price: c.precio,
              publicado: publicar,
              piezas: c.piezas,
              brandId: prendaPorId.get(c.piezas[0]?.prendaId)?.brandId || '',
            }));
          }
        } finally {
          await refrescar();
        }
        return lista.length;
      }}
    />
  );
}
