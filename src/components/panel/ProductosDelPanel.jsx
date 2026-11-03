import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { deleteField } from '../../services/firebase/observed';
import { useAuth } from '../../contexts/AuthContext';
import {
  getProducts, getProduct, getCategories, deleteProduct, updateProductField, createProduct,
} from '../../services/products';
import { getBrands } from '../../services/brands';
import { getCollections } from '../../services/collections';
import { getTags } from '../../services/tags';
import { getProductTypes } from '../../services/productTypes';
import { getPrendasBaseAdmin } from '../../services/prendasBase';
import { getCombosCrear } from '../../services/combosCrear';
import { deleteFile } from '../../services/firebase/storage';
import { updateDocument } from '../../services/firebase/firestore';
import { logInventoryChange } from '../../services/inventoryLogs';
import { quitarPersonalizacionVieja } from '../../services/personalizacionVieja';
import { exportProducts } from '../../utils/exportProducts';
import { SINONIMOS, publicoDe, edadMinimaDe, equipoDe, textoProducto } from '../../utils/giftRecommender.mjs';
import { PaginaProductos, PaginaInventario, PaginaRecomendar } from '../../componentes/kit/paginas/admin/Productos';
import { productoAdminDesde, categoriaDesdeFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { PersonalizablesDelPanel, PacksDelPanel } from './CrearDelPanel';
import { sinError, useLectura, useInvalidar } from './comun';

const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });
const VISTAS = ['tienda', 'crear', 'packs', 'todos'];
const nombres = (lista = []) => lista.map((x) => ({ id: x.id, nombre: x.name || x.id }));

/** Uno por uno, contando los que fallan (como las páginas de antes). */
async function unoPorUno(ids, accion) {
  let ok = 0;
  let fallaron = 0;
  for (const id of ids) {
    try {
      const r = await accion(id);
      if (r?.error) fallaron += 1; else ok += 1;
    } catch {
      fallaron += 1;
    }
  }
  return { ok, fallaron };
}

/* Los borradores de productos nuevos guardados en este aparato (los mismos de la ficha). */
const leerBorradores = () => { try { return JSON.parse(localStorage.getItem('wala_drafts') || '[]'); } catch { return []; } };

/*
 * /admin/productos (D2a): PaginaProductos con los servicios de AdminProductos.
 * Las pestañas Personalizables y Packs son las de Crear (CrearDelPanel); ?ver=
 * elige la pestaña. Mostrar u ocultar escribe solo `visible`
 * (updateProductField): nunca el producto entero desde la fila de la tabla.
 * Descartar un borrador borra sus fotos de Storage solo si ese producto nunca
 * se publicó (la regla P0 de AdminProductos).
 */
export default function ProductosDelPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vista = VISTAS.includes(searchParams.get('ver')) ? searchParams.get('ver') : 'tienda';
  const productos = useLectura(['admin-products'], productosConOcultos);
  const categorias = useLectura(['admin-categories'], getCategories);
  const marcas = useLectura(['admin-brands'], getBrands);
  // Las cuentas de las pestañas de Crear, con las claves de CrearDelPanel (comparten la caché).
  const prendas = useQuery({ queryKey: ['admin-prendas-crear'], queryFn: () => sinError(getPrendasBaseAdmin()) });
  const packs = useQuery({ queryKey: ['admin-combos-crear'], queryFn: () => sinError(getCombosCrear({ incluirBorradores: true })) });
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-products'], ['products'], ['featured-products'], ['collection-products']);
  const [borradores, setBorradores] = useState(leerBorradores);

  const crudos = useMemo(() => productos.datos || [], [productos.datos]);
  const porId = useMemo(() => new Map(crudos.map((p) => [p.id, p])), [crudos]);
  const lista = useMemo(() => crudos.map(productoAdminDesde).filter(Boolean), [crudos]);

  return (
    <PaginaProductos
      productos={lista}
      categorias={nombres(categorias.datos)}
      marcas={nombres(marcas.datos)}
      cargando={productos.cargando}
      error={productos.error}
      onReintentar={productos.onReintentar}
      vista={vista}
      onVista={(v) => navigate(v === 'tienda' ? '/admin/productos' : `/admin/productos?ver=${v}`)}
      personalizables={<PersonalizablesDelPanel />}
      packs={<PacksDelPanel nuevoInicial={searchParams.get('nuevo') === '1'} />}
      cuentas={{
        crear: (prendas.data || []).filter((p) => !p.deleted).length,
        packs: (packs.data || []).filter((c) => !c.deleted).length,
      }}
      onAbrir={(p) => {
        const c = porId.get(p.id);
        navigate(c?.esComboCrear ? '/admin/productos?ver=packs' : c?.esPrendaBase ? `/admin/prendas-crear/${p.id}` : `/admin/productos/${p.id}`);
      }}
      onIr={(url) => navigate(url)}
      onVisible={async (id, visible) => { await updateProductField(id, { visible }); await refrescar(); }}
      onVarios={async (ids, visible) => {
        const r = await unoPorUno(ids, (id) => updateProductField(id, { visible }));
        await refrescar();
        return r;
      }}
      onArchivar={async (ids) => {
        const r = await unoPorUno(ids, (id) => deleteProduct(id));
        await refrescar();
        return r;
      }}
      onDuplicar={async (p) => {
        const { id: _id, createdAt: _creado, ...datos } = porId.get(p.id) || {};
        await sinError(createProduct({ ...datos, name: `${datos.name} (Copia)`, visible: false }));
        await refrescar();
      }}
      onExportar={(ids) => exportProducts(crudos.filter((p) => !p.deleted), categorias.datos || [], ids && ids.length ? ids : null)}
      onQuitarPersonalizacionVieja={async (ids) => {
        const r = await unoPorUno(ids, (id) => quitarPersonalizacionVieja(porId.get(id)));
        await invalidar(['admin-products'], ['products']);
        return r;
      }}
      borradores={borradores.map((d) => ({ id: d.draftId, nombre: d.form?.name || 'Producto sin nombre', fecha: d.updatedAt }))}
      urlBorrador={(id) => `/admin/productos/nuevo?draftId=${id}`}
      onDescartarBorrador={async (id) => {
        const borrador = borradores.find((d) => d.draftId === id);
        if (!borrador) return;
        // Un producto ya publicado comparte sus fotos con el borrador: esas no se tocan.
        // Ante la duda (sin red), se asume publicado.
        let publicado = porId.has(id);
        if (!publicado) {
          try { publicado = Boolean((await getProduct(id)).data); } catch { publicado = true; }
        }
        if (!publicado) {
          const urls = (borrador.form?.variants || []).flatMap((v) => [v.imageUrl, ...(v.images || [])]).filter(Boolean);
          await Promise.all(urls.map((u) => deleteFile(u).catch(() => {})));
        }
        const quedan = leerBorradores().filter((d) => d.draftId !== id);
        try { localStorage.setItem('wala_drafts', JSON.stringify(quedan)); } catch { /* sin localStorage */ }
        setBorradores(quedan);
      }}
    />
  );
}

/*
 * /admin/inventario (D2a): el stock de todo, sin los archivados. Guardar
 * escribe solo inStock y anota el cambio (logInventoryChange), como antes.
 */
export function InventarioDelPanel() {
  const { user } = useAuth();
  const productos = useLectura(['admin-inventory-products'], productosConOcultos);
  const categorias = useLectura(['categories'], getCategories);
  const colecciones = useLectura(['collections'], getCollections);
  const marcas = useLectura(['brands'], getBrands);
  const tipos = useLectura(['productTypes'], getProductTypes);
  const invalidar = useInvalidar();
  const crudos = productos.datos || [];

  return (
    <PaginaInventario
      productos={crudos.map(productoAdminDesde).filter(Boolean)}
      categorias={nombres(categorias.datos)}
      colecciones={nombres(colecciones.datos)}
      marcas={nombres(marcas.datos)}
      tipos={nombres(tipos.datos)}
      cargando={productos.cargando}
      error={productos.error}
      onReintentar={productos.onReintentar}
      onGuardarStock={async (id, nuevo, anterior) => {
        await updateProductField(id, { inStock: nuevo });
        const nombre = crudos.find((p) => p.id === id)?.name || id;
        await logInventoryChange(id, nombre, anterior, nuevo, user?.email || 'Admin');
        await invalidar(['admin-inventory-products'], ['admin-products'], ['products']);
      }}
    />
  );
}

const marcado = (v) => v != null && v !== '';

/*
 * /admin/publico-productos (D2a): para quién es cada producto, desde qué
 * edad y de qué equipo (las ideas de regalo). Lo que no está marcado se
 * sugiere con giftRecommender. Guardar escribe solo esos campos; null los
 * quita (deleteField, lo mismo que ya hace updateDocument con un campo
 * vaciado). En lote, de a 20.
 */
export function RecomendarDelPanel() {
  const productos = useLectura(['admin-publico-productos'], productosConOcultos, { staleTime: 60 * 1000 });
  const categorias = useLectura(['admin-categories'], getCategories);
  const dicts = useQuery({
    queryKey: ['admin-datos-recomendar-dicts'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [t, c] = await Promise.all([getTags(), getCollections()]);
      const aMapa = (l) => Object.fromEntries((l || []).map((x) => [x.id, x.name || '']));
      return { tags: aMapa(t.data), collections: aMapa(c.data) };
    },
  });
  const invalidar = useInvalidar();
  const d = useMemo(() => dicts.data || {}, [dicts.data]);
  const crudos = useMemo(() => (productos.datos || []).filter((p) => !p.deleted), [productos.datos]);
  const porId = useMemo(() => new Map(crudos.map((p) => [p.id, p])), [crudos]);

  const equipos = useMemo(() => {
    const set = new Set(SINONIMOS.filter((g) => g.club).map((g) => g.canon.replace(/\b\w/g, (x) => x.toUpperCase())));
    crudos.forEach((p) => { const e = equipoDe(p, d).nombre; if (e) set.add(e); });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [crudos, d]);

  // La sugerencia de lo que falta (lo marcado no se sugiere).
  const sugerenciaDe = (fila) => {
    const p = porId.get(fila.id) || {};
    const txt = textoProducto(p, d);
    const edad = edadMinimaDe(p, txt);
    const equipo = equipoDe(p, d);
    return {
      publico: marcado(p.publico) ? undefined : publicoDe({ ...p, publico: null }, txt),
      edadMinima: edad.deducida ? edad.valor : undefined,
      equipo: equipo.deducido ? equipo.nombre : undefined,
    };
  };
  const escribir = (id, campos) => updateDocument('productos_wala', id, Object.fromEntries(
    Object.entries(campos).map(([k, v]) => [k, v === null || v === '' ? deleteField() : v]),
  ));
  const enLotes = async (cambios) => {
    let ok = 0;
    let fallaron = 0;
    for (let i = 0; i < cambios.length; i += 20) {
      const res = await Promise.all(cambios.slice(i, i + 20).map(([id, campos]) => escribir(id, campos)));
      res.forEach((r) => { if (r?.error) fallaron += 1; else ok += 1; });
    }
    await refrescar();
    return { ok, fallaron };
  };
  const refrescar = () => invalidar(['admin-publico-productos'], ['admin-products'], ['products'], ['gift-catalog-dicts']);

  return (
    <PaginaRecomendar
      productos={crudos.map(productoAdminDesde).filter(Boolean)}
      categorias={(categorias.datos || []).map(categoriaDesdeFirestore).map((c) => ({ id: c.id, nombre: c.nombre }))}
      sugerenciaDe={sugerenciaDe}
      equipos={equipos}
      cargando={productos.cargando || dicts.isLoading}
      error={productos.error}
      onReintentar={productos.onReintentar}
      onGuardar={async (id, campos) => { await sinError(escribir(id, campos)); await refrescar(); }}
      onAceptarSugerencias={(ids) => enLotes(ids.map((id) => {
        const s = sugerenciaDe({ id });
        const campos = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null && v !== ''));
        return [id, campos];
      }).filter(([, c]) => Object.keys(c).length))}
      onMarcarTodos={(ids, publico) => enLotes(ids.map((id) => [id, { publico }]))}
    />
  );
}
