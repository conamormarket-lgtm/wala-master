import React, { useMemo } from 'react';
import { Cabecera, BarraInferior } from '../Navegacion';
import { RenderSecciones } from '../Secciones';
import { PiePagina } from '../piezas/Pie';
import { TemaMarca } from '../piezas/TemaMarca';
import { PilaFlotante } from '../piezas/Flotantes';
import { PieLegal } from '../piezas/Marco';
import s from './Paginas.module.css';

/*
 * Páginas: el último eslabón de la cadena piezas → secciones → páginas.
 * Cada página se arma solo con secciones y piezas del kit; los datos entran
 * por props (en la tienda: CartContext, pedidos de Firestore, la config del
 * builder…).
 */

/**
 * Marco de cualquier página de la tienda: avisos arriba, cabecera, contenido
 * y pie de página; en el celular, la barra inferior; y lo que flota encima.
 *  - arriba: nodos sobre la cabecera (AvisoSistema, BannerApp, BarraAdmin)
 *  - cabecera: props de <Cabecera> (o null para landings sin menú)
 *  - pie: ajustes de footer_columns (o null)  · pieLegal: props de <PieLegal>
 *  - kapiEnPie: Kapi asomado por el pie (false si la página ya termina con uno)
 *  - barraInferior: props de <BarraInferior> (o null)
 *  - flotantes: { derecha, izquierda } → <PilaFlotante> (WhatsApp, Kapi…)
 *  - contenida: el marco vive dentro de algo con su propio scroll (demo,
 *    editor): los flotantes se pegan al marco y no a la ventana.
 * Cada parte lleva data-componente (Cabecera, PiePagina, BarraInferior) para
 * ubicarla en la guía (kit/guia) y en "Ver componentes".
 */
export function MarcoTienda({ arriba, cabecera, pie, pieLegal, kapiEnPie = true, barraInferior, flotantes, contenida = false, children }) {
  return (
    <div className={s.marco}>
      {arriba && <div className={s.arriba}>{arriba}</div>}
      {cabecera && <div className={s.cabecera} data-componente="Cabecera"><Cabecera {...cabecera} /></div>}
      <main className={s.contenido}>{children}</main>
      {(pie || pieLegal) && (
        <div data-componente="PiePagina">
          <div className={s.pie}>
            <PiePagina ajustes={pie || {}} pieLegal={pieLegal && <PieLegal {...pieLegal} />} kapi={kapiEnPie} />
          </div>
        </div>
      )}
      {flotantes && (
        <div className={s.flotantes}>
          <PilaFlotante contenida={contenida} izquierda={flotantes.izquierda}>{flotantes.derecha}</PilaFlotante>
        </div>
      )}
      {barraInferior && <div className={s.barraInferior} data-componente="BarraInferior"><BarraInferior {...barraInferior} /></div>}
    </div>
  );
}

/**
 * Qué lista de productos va en cada tipo de sección, igual que en
 * TiendaPage: destacados (featured), más nuevos (new_arrivals), con
 * salePrice (sale y flash_sales), por categoría o colección, o todos. Un
 * catálogo o grilla fijado a una marca (settings.brandId) toma solo los de esa
 * marca.
 */
export function productosDeSeccion(productos = {}, sec) {
  const st = sec?.settings || {};
  switch (sec?.type) {
    case 'featured_carousel':
    case 'featured_products': return productos.destacados || [];
    case 'new_arrivals_carousel': return productos.nuevos || [];
    case 'sale_carousel':
    case 'flash_sales': return productos.ofertas || [];
    case 'category_carousel': return productos.porCategoria?.[st.categoryId] || [];
    case 'collection_carousel': return productos.porColeccion?.[st.collection] || [];
    case 'sidebar_catalog':
    case 'product_grid': return st.brandId ? (productos.todos || []).filter((p) => p.brandId === st.brandId) : productos.todos || [];
    default: return productos.todos || [];
  }
}

/**
 * Página del builder (inicio, tienda, landings): el marco + las secciones
 * guardadas en Firestore (`pages/{id}`).
 *  - productos: { destacados, nuevos, ofertas, porCategoria, porColeccion,
 *    todos } → cada sección toma la suya (productosDeSeccion). O, para
 *    decidir a mano, productosPara(seccion) como en <RenderSecciones>.
 *  - categorias: [{ categoryId, name, imageUrl, imagenProducto, cuenta }]
 *    con productos, en el orden del admin (category_grid automático, que
 *    aplica su orden, límite y foto; categories_nav). imagenProducto = foto
 *    de un producto de la categoría (imageSource 'product').
 *  - marcas: tienda_brands (banner_grid de marcas, sello en las tarjetas).
 *  - marcaActual: id de la marca de la página (landing de marca).
 *  - navPorMarca: { [brandId]: { items, estilo } } (navDeMarca): las
 *    burbujas y el estilo de cada categories_nav que apunta a una marca,
 *    como TiendaPage (la lista curada de la marca, no las categorías sueltas).
 *  - tema: { color, color2 } → las secciones (y `antes`) van dentro de
 *    TemaMarca: la página de una marca con su color en los acentos.
 *  - antes: lo que va antes de las secciones (la portada de una marca).
 *  - kapiEnPie: para forzarlo (si no, sale salvo que la página termine con
 *    Preguntas frecuentes).
 *  - El resto: props del marco (cabecera, pie, flotantes…) y de
 *    <RenderSecciones> (onAgregar, propsPara, respaldo, envolver).
 */
export function PaginaTienda({
  arriba, cabecera, pie, pieLegal, barraInferior, flotantes, contenida,
  productos, productosPara, categorias = [], marcas = [], marcaActual = null, navPorMarca = {},
  tema, antes, kapiEnPie: kapiForzado, ...secciones
}) {
  const navDe = (sec) => (sec.type === 'categories_nav' ? navPorMarca[(sec.settings?.brandId || '').trim()] : undefined);
  const catalogo = useMemo(() => ({ marcas, categorias, marcaActual }), [marcas, categorias, marcaActual]);
  // Un solo Kapi a la vista: si la página termina con Preguntas frecuentes
  // (su tarjeta de ayuda trae a Kapi), el pie no lo repite.
  const orden = [...(secciones.secciones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const kapiEnPie = kapiForzado ?? orden[orden.length - 1]?.type !== 'faq_accordion';
  const contenido = (
    <>
      {antes}
      <RenderSecciones
        productosPara={productosPara || ((sec) => productosDeSeccion(productos, sec))}
        // Con items puestos a mano en el editor mandan esos; si no, las
        // categorías automáticas.
        categoriasPara={(sec) => navDe(sec)?.items || (sec.settings?.items?.length && sec.settings.dataSource !== 'products' ? undefined : categorias)}
        marcasPara={() => marcas}
        catalogo={catalogo}
        {...secciones}
        propsPara={(sec) => ({ ...(navDe(sec) ? { estilo: navDe(sec).estilo } : {}), ...secciones.propsPara?.(sec) })}
      />
    </>
  );
  return (
    <MarcoTienda {...{ arriba, cabecera, pie, pieLegal, kapiEnPie, barraInferior, flotantes, contenida }}>
      {tema ? <TemaMarca identidad={tema}>{contenido}</TemaMarca> : contenido}
    </MarcoTienda>
  );
}

// El carrito vive en su propio archivo (baja solo con /carrito).
export { PaginaCarrito } from './Carrito';

/* ── Zona Arcade (/minijuegos) ─────────────────────────── */

// La Zona Arcade vive en su propio archivo (baja solo con /minijuegos).
export { PaginaMinijuegos } from './Minijuegos';

/* ── Búsqueda (/buscar) ─────────────────────────────────── */

// La búsqueda vive en su propio archivo (baja solo con /buscar).
export { PaginaBusqueda } from './Busqueda';
