import React from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/categories';
import { getBrands } from '../../services/brands';
import { getProductTypes, createProductType } from '../../services/productTypes';
import { getProducts, updateProductField } from '../../services/products';
import { PaginaCategorias } from '../../componentes/kit/paginas/admin/Categorias';
import { categoriaDesdeFirestore, categoriaAFirestore, marcaAdminDesdeFirestore, tiposParaSincronizar, tiposSugeridosDeCategorias, mismoNombre } from '../../componentes/kit/adaptadoresAdmin';
import { useToast } from '../../componentes/kit/Feedback';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

const subirImagen = subirA('categories', 'categoria');
const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });

/*
 * /admin/categorias (D1): PaginaCategorias con los mismos servicios y claves
 * de AdminCategorias; guardar invalida también ['categories'] de la tienda.
 * El tipo de producto vive en la categoría (2026-11-04): al guardarla se les
 * pone a sus productos (los que la tienen de principal), así el filtro «Tipo»
 * de la tienda y de la app los encuentra a todos.
 */
export default function CategoriasDelPanel() {
  const categorias = useLectura(['admin-categories'], getCategories);
  const marcas = useLectura(['admin-brands'], getBrands);
  const tipos = useLectura(['admin-product-types'], getProductTypes);
  const productos = useLectura(['admin-products'], productosConOcultos);
  const invalidar = useInvalidar();
  const toast = useToast();
  const refrescar = () => invalidar(['admin-categories'], ['categories']);
  const sugeridos = React.useMemo(() => tiposSugeridosDeCategorias(productos.datos || []), [productos.datos]);

  return (
    <PaginaCategorias
      categorias={(categorias.datos || []).map(categoriaDesdeFirestore)}
      marcas={(marcas.datos || []).map(marcaAdminDesdeFirestore)}
      cargando={categorias.cargando || marcas.cargando}
      error={categorias.error || marcas.error}
      onReintentar={() => { categorias.onReintentar(); marcas.onReintentar(); }}
      tipos={(tipos.datos || []).map((t) => ({ id: t.id, nombre: t.name || t.id }))}
      tiposSugeridos={sugeridos}
      // Ponerlos todos: crea los tipos que no existen, guarda cada categoría y
      // les pasa el tipo a sus productos. Sigue aunque uno falle (los cuenta).
      onPonerTipos={async (lista) => {
        const existentes = (tipos.datos || []).map((t) => ({ id: t.id, nombre: t.name || '' }));
        const idDe = new Map();
        let fallaron = 0;
        for (const nombre of [...new Set(lista.map((x) => x.tipo))]) {
          const hay = existentes.find((t) => mismoNombre(t.nombre, nombre));
          if (hay) { idDe.set(nombre, hay.id); continue; }
          const r = await createProductType({ name: nombre });
          if (r?.error || !(r?.data?.id || r?.id)) { fallaron += 1; continue; }
          idDe.set(nombre, r.data?.id || r.id);
        }
        let hechas = 0;
        let productosCambiados = 0;
        for (const { id, tipo } of lista) {
          const tipoId = idDe.get(tipo);
          if (!tipoId) { fallaron += 1; continue; }
          try {
            await sinError(updateCategory(id, { productType: tipoId }));
            hechas += 1;
          } catch { fallaron += 1; continue; }
          for (const p of tiposParaSincronizar(productos.datos || [], id, tipoId)) {
            try { await updateProductField(p.id, { productType: p.productType }); productosCambiados += 1; } catch { fallaron += 1; }
          }
        }
        await refrescar();
        await invalidar(['admin-product-types'], ['productTypes'], ['admin-products'], ['products']);
        return { categorias: hechas, productos: productosCambiados, fallaron };
      }}
      onCrearTipo={async (nombre) => {
        // createDocument devuelve { id, error } (no { data }).
        const r = await createProductType({ name: String(nombre).trim() });
        if (r?.error) throw new Error(r.error);
        await invalidar(['admin-product-types'], ['productTypes']);
        return { id: r.data?.id || r.id, nombre: String(nombre).trim() };
      }}
      onGuardar={async (datos, id) => {
        const doc = categoriaAFirestore(datos);
        await sinError(id ? updateCategory(id, doc) : createCategory(doc));
        // Sus productos toman el tipo (solo los que cambian).
        const cambian = id ? tiposParaSincronizar(productos.datos || [], id, doc.productType) : [];
        let fallaron = 0;
        for (const p of cambian) {
          try { await updateProductField(p.id, { productType: p.productType }); } catch { fallaron += 1; }
        }
        await refrescar();
        if (cambian.length) {
          await invalidar(['admin-products'], ['products'], ['productTypes']);
          toast(fallaron
            ? { tipo: 'aviso', titulo: `${cambian.length - fallaron} productos con su tipo; ${fallaron} no se pudieron`, texto: 'Vuelve a guardar la categoría para intentar con esos.' }
            : { tipo: 'exito', titulo: `${cambian.length} ${cambian.length === 1 ? 'producto tomó' : 'productos tomaron'} el tipo de la categoría` });
        }
      }}
      onEliminar={async (id) => {
        await sinError(deleteCategory(id));
        await refrescar();
      }}
      // Ordenar: se numeran 1, 2, 3… y solo se escriben las que cambian de número.
      onGuardarOrden={async (ids) => {
        const antes = new Map((categorias.datos || []).map((c) => [c.id, c.order]));
        const cambian = ids.map((id, i) => [id, i + 1]).filter(([id, n]) => antes.get(id) !== n);
        await Promise.all(cambian.map(([id, order]) => sinError(updateCategory(id, { order }))));
        await refrescar();
      }}
      subirImagen={subirImagen}
    />
  );
}
