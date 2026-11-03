import React, { useMemo } from 'react';
import { getCollections, createCollection, updateCollection, deleteCollection } from '../../services/collections';
import { getBrands } from '../../services/brands';
import { getProducts } from '../../services/products';
import { getProductTypes, createProductType, updateProductType, deleteProductType } from '../../services/productTypes';
import { getTags, createTag, updateTag, deleteTag } from '../../services/tags';
import { getCharacters, createCharacter, updateCharacter, deleteCharacter } from '../../services/characters';
import { getShippingZones, createShippingZone, updateShippingZone, deleteShippingZone } from '../../services/shippingZones';
import { PaginaColecciones, PaginaAtributos, PaginaEnvios } from '../../componentes/kit/paginas/admin/Catalogo';
import {
  coleccionDesdeFirestore, coleccionAFirestore, usosDeAtributo, atributoDesdeFirestore, atributoAFirestore,
  zonaDesdeFirestore, zonaAFirestore, marcaAdminDesdeFirestore,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * Las listas simples del catálogo (D1): colecciones, atributos, zonas de
 * envío. Los mismos servicios, claves e invalidaciones que
 * AdminColecciones, AdminCatalogAttributes y AdminEnviosZonas.
 */

const subirColeccion = subirA('collections', 'coleccion');

export function ColeccionesDelPanel() {
  const colecciones = useLectura(['admin-collections'], getCollections);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-collections'], ['collections']);
  return (
    <PaginaColecciones
      colecciones={(colecciones.datos || []).map(coleccionDesdeFirestore)}
      cargando={colecciones.cargando}
      error={colecciones.error}
      onReintentar={colecciones.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = coleccionAFirestore(datos);
        await sinError(id ? updateCollection(id, doc) : createCollection(doc));
        await refrescar();
      }}
      onEliminar={async (id) => { await sinError(deleteCollection(id)); await refrescar(); }}
      // Ordenar: se numeran 1, 2, 3… y solo se escriben las que cambian de número.
      onGuardarOrden={async (ids) => {
        const antes = new Map((colecciones.datos || []).map((c) => [c.id, c.order]));
        const cambian = ids.map((id, i) => [id, i + 1]).filter(([id, n]) => antes.get(id) !== n);
        await Promise.all(cambian.map(([id, order]) => sinError(updateCollection(id, { order }))));
        await refrescar();
      }}
      subirImagen={subirColeccion}
    />
  );
}

// Cada pestaña del kit con su colección: la clave del admin y la de la tienda.
const SERVICIOS_ATRIBUTO = {
  tipos: { clave: ['admin-product-types'], publica: ['productTypes'], leer: getProductTypes, crear: createProductType, editar: updateProductType, eliminar: deleteProductType },
  etiquetas: { clave: ['admin-tags'], publica: ['tags'], leer: getTags, crear: createTag, editar: updateTag, eliminar: deleteTag },
  personajes: { clave: ['admin-characters'], publica: ['characters'], leer: getCharacters, crear: createCharacter, editar: updateCharacter, eliminar: deleteCharacter },
};
const productosConOcultos = () => getProducts([], null, null, { includeHidden: true });

export function AtributosDelPanel() {
  const tipos = useLectura(SERVICIOS_ATRIBUTO.tipos.clave, getProductTypes);
  const etiquetas = useLectura(SERVICIOS_ATRIBUTO.etiquetas.clave, getTags);
  const personajes = useLectura(SERVICIOS_ATRIBUTO.personajes.clave, getCharacters);
  const marcas = useLectura(['admin-brands'], getBrands);
  const productos = useLectura(['admin-products-attribute-usage'], productosConOcultos);
  const invalidar = useInvalidar();
  const listas = { tipos, etiquetas, personajes };

  const atributos = useMemo(() => Object.fromEntries(Object.entries(listas).map(([tipo, l]) => {
    const usos = usosDeAtributo(productos.datos || [], tipo);
    return [tipo, (l.datos || []).map((d) => atributoDesdeFirestore(d, usos))];
  })), [tipos.datos, etiquetas.datos, personajes.datos, productos.datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const refrescar = (tipo) => invalidar(SERVICIOS_ATRIBUTO[tipo].clave, SERVICIOS_ATRIBUTO[tipo].publica, ['admin-products-attribute-usage']);
  const todas = [tipos, etiquetas, personajes, marcas, productos];

  return (
    <PaginaAtributos
      atributos={atributos}
      marcas={(marcas.datos || []).map(marcaAdminDesdeFirestore)}
      cargando={todas.some((l) => l.cargando)}
      error={todas.find((l) => l.error)?.error}
      onReintentar={() => todas.forEach((l) => l.onReintentar())}
      onGuardar={async (tipo, datos, id) => {
        const s = SERVICIOS_ATRIBUTO[tipo];
        const doc = atributoAFirestore(datos, tipo);
        await sinError(id ? s.editar(id, doc) : s.crear(doc));
        await refrescar(tipo);
      }}
      onEliminar={async (tipo, id) => {
        await sinError(SERVICIOS_ATRIBUTO[tipo].eliminar(id));
        await refrescar(tipo);
      }}
      // Los que no están en ningún producto, de a uno (con el mismo eliminar) y refrescando una sola vez al final.
      onQuitarSinUsar={async (tipo, ids) => {
        const nombreDe = new Map((atributos[tipo] || []).map((r) => [r.id, r.nombre]));
        let quitados = 0;
        const fallaron = [];
        for (const id of ids) {
          const { error: fallo } = await SERVICIOS_ATRIBUTO[tipo].eliminar(id);
          if (fallo) fallaron.push(nombreDe.get(id) || id); else quitados += 1;
        }
        await refrescar(tipo);
        return { quitados, fallaron };
      }}
    />
  );
}

export function EnviosDelPanel() {
  const zonas = useLectura(['admin-shipping-zones'], getShippingZones);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-shipping-zones'], ['shipping-zones']);
  return (
    <PaginaEnvios
      zonas={(zonas.datos || []).map(zonaDesdeFirestore)}
      cargando={zonas.cargando}
      error={zonas.error}
      onReintentar={zonas.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = zonaAFirestore(datos);
        await sinError(id ? updateShippingZone(id, doc) : createShippingZone(doc));
        await refrescar();
      }}
      onEliminar={async (id) => { await sinError(deleteShippingZone(id)); await refrescar(); }}
    />
  );
}
