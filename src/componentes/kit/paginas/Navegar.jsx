import React from 'react';
import { Search, ArrowLeft, Store, Shapes } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { Trazo, Sello } from '../Marca';
import { Texto } from '../Traduccion';
import { BloqueSeccion } from '../Seccion';
import { Encabezado } from '../SeccionesContenido';
import { GrillaProductos } from '../SeccionesExtra';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TarjetaCategoria } from '../piezas/TarjetaCategoria';
import { Avatar } from '../piezas/Avatar';
import { Migas } from '../piezas/Ficha';
import s from './Navegar.module.css';

/*
 * Navegar la tienda fuera del builder: los nichos (/nichos), un nicho
 * (/nicho/:slug) y la tienda de un vendedor (/tienda-vendedor/:slug). (Las
 * ofertas flash y el cofre diario se retiraron el 2026-10-16.) Las landings (/:slug) son del builder: van con
 * PaginaTienda.
 */

/** "Buscar productos" y "Volver a la tienda": el pie de nichos y vendedores. */
function PieNavegar({ urlBuscar = '/buscar', urlTienda = '/' }) {
  return (
    <div className={s.pie}>
      <Boton to={urlBuscar} variante="secundario" icono={<Search aria-hidden="true" />}>Buscar productos</Boton>
      <Boton to={urlTienda} variante="fantasma" icono={<ArrowLeft aria-hidden="true" />}>Volver a la tienda</Boton>
    </div>
  );
}

const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ── Nichos (/nichos) ───────────────────────────────────── */

/**
 * Todos los nichos en cuadros (la tarjeta de category_grid).
 *  - nichos: [{ categoryId, name, imageUrl, url, detalle }]
 *    (nichoDesdeFirestore; los inactivos ya fuera)
 *  - estado: 'cargando'
 */
export function PaginaNichos({ nichos = [], estado, titulo = 'Explora por nicho', urlBuscar, urlTienda }) {
  if (estado === 'cargando') return <EsqueletoPagina forma="nichos" />;
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '0.5rem' }}>
        <Encabezado ajustes={{ title: titulo, subtitle: nichos.length ? `${cuantos(nichos.length, 'nicho', 'nichos')} para elegir: cada uno con sus productos.` : undefined }} />
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        {nichos.length ? (
          <ul className={s.nichos} data-componente="GrillaNichos">
            {nichos.map((n, k) => (
              <li key={n.categoryId}>
                <TarjetaCategoria forma="cuadro" nombre={n.name} imagen={n.imageUrl} url={n.url} detalle={n.detalle} giro={k % 2 ? 2.5 : -2.5} />
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVacio titulo="Aún no hay nichos" texto="Pronto vas a poder recorrer la tienda por temas. Mientras, busca lo que se te antoje." />
        )}
        <PieNavegar urlBuscar={urlBuscar} urlTienda={urlTienda} />
      </BloqueSeccion>
    </>
  );
}

/* ── Un nicho (/nicho/:slug) y la tienda de un vendedor (/tienda-vendedor/:slug) ── */

const TEXTOS_COLECCION = {
  nicho: {
    migas: { texto: 'Nichos', url: '/nichos' },
    cuenta: (n) => `${cuantos(n, 'producto', 'productos')} en este nicho`,
    vacio: { titulo: 'Aún no hay productos en este nicho', texto: 'Estamos preparando los primeros. Vuelve pronto.' },
    noEncontrado: { titulo: 'No encontramos este nicho', texto: 'Puede que haya cambiado de nombre. Mira todos los nichos.', boton: 'Ver todos los nichos', url: '/nichos' },
  },
  vendedor: {
    migas: { texto: 'Tienda', url: '/tienda' },
    cuenta: (n) => `${cuantos(n, 'producto', 'productos')} de esta tienda`,
    vacio: { titulo: 'Esta tienda aún no tiene productos publicados', texto: 'Mientras, explora otros productos de Walá.' },
    noEncontrado: { titulo: 'No encontramos esta tienda', texto: 'Revisa el enlace o sigue explorando Walá.', boton: 'Ir a la tienda', url: '/tienda' },
  },
};

/**
 * Los productos de un nicho o de un vendedor: la cabeza (logo o foto, el
 * nombre con su trazo y cuántos hay) y la grilla de la tienda con "Ver más".
 *  - tipo: 'nicho' | 'vendedor'
 *  - titulo · imagen (foto del nicho o logo del vendedor; sin ella, un sello)
 *  - total: cuántos productos hay (los cargados pueden ser menos)
 *  - productos (productos_wala) · hayMas, onCargarMas, cargandoMas · catalogo · onAgregar
 *  - estado: 'cargando' | 'noEncontrado'
 */
export function PaginaColeccion({
  tipo = 'nicho', titulo, imagen, total, productos = [], hayMas, onCargarMas, cargandoMas, catalogo, onAgregar, estado, urlBuscar, urlTienda,
}) {
  const t = TEXTOS_COLECCION[tipo] || TEXTOS_COLECCION.nicho;
  if (estado === 'cargando') return <EsqueletoPagina forma="coleccion" />;
  if (estado === 'noEncontrado') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo={t.noEncontrado.titulo} texto={t.noEncontrado.texto}>
          <Boton to={t.noEncontrado.url} icono={tipo === 'nicho' ? <Shapes aria-hidden="true" /> : <Store aria-hidden="true" />}>{t.noEncontrado.boton}</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const n = total ?? productos.length;
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '0.5rem' }}>
        <Migas items={[{ texto: 'Inicio', url: '/' }, t.migas, { texto: titulo }]} />
        <header className={s.cabeza} data-componente="CabezaColeccion">
          {imagen ? (
            <Avatar nombre={titulo} imagen={imagen} className={[s.logo, tipo === 'nicho' && s.logoCuadrado].filter(Boolean).join(' ')} />
          ) : (
            <Sello tamano={56}>{tipo === 'nicho' ? <Shapes aria-hidden="true" /> : <Store aria-hidden="true" />}</Sello>
          )}
          <div className={s.cabezaTexto}>
            <h1 className={s.titulo}><Texto>{titulo}</Texto><Trazo className={s.trazo} /></h1>
            <p className={s.cuenta}>{t.cuenta(n)}</p>
          </div>
        </header>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <GrillaProductos
          productos={productos}
          hayMas={hayMas}
          onCargarMas={onCargarMas}
          cargandoMas={cargandoMas}
          catalogo={catalogo}
          onAgregar={onAgregar}
          vacio={t.vacio}
        />
        <PieNavegar urlBuscar={urlBuscar} urlTienda={urlTienda} />
      </BloqueSeccion>
    </>
  );
}
