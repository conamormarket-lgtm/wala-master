import React from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/categories';
import { getBrands } from '../../services/brands';
import { PaginaCategorias } from '../../componentes/kit/paginas/admin/Categorias';
import { categoriaDesdeFirestore, categoriaAFirestore, marcaAdminDesdeFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

const subirImagen = subirA('categories', 'categoria');

/*
 * /admin/categorias (D1): PaginaCategorias con los mismos servicios y claves
 * de AdminCategorias; guardar invalida también ['categories'] de la tienda.
 */
export default function CategoriasDelPanel() {
  const categorias = useLectura(['admin-categories'], getCategories);
  const marcas = useLectura(['admin-brands'], getBrands);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-categories'], ['categories']);

  return (
    <PaginaCategorias
      categorias={(categorias.datos || []).map(categoriaDesdeFirestore)}
      marcas={(marcas.datos || []).map(marcaAdminDesdeFirestore)}
      cargando={categorias.cargando || marcas.cargando}
      error={categorias.error || marcas.error}
      onReintentar={() => { categorias.onReintentar(); marcas.onReintentar(); }}
      onGuardar={async (datos, id) => {
        const doc = categoriaAFirestore(datos);
        await sinError(id ? updateCategory(id, doc) : createCategory(doc));
        await refrescar();
      }}
      onEliminar={async (id) => {
        await sinError(deleteCategory(id));
        await refrescar();
      }}
      subirImagen={subirImagen}
    />
  );
}
