import React, { useMemo, useState } from 'react';
import {
  PaginaOfertas, PaginaNichos, PaginaColeccion, ofertaDesdeFirestore, ofertasVigentes, nichoDesdeFirestore, tarjetaDesdeProducto,
} from './kit';
import { limaTodayStr, msHastaMananaLima } from '../utils/fechaLima';
import { volarMonedasGanadas } from '../utils/animations';
import TIENDA from './demo/tienda.json';
import INICIO from './demo/inicio.json';
import MARCAS from './demo/marcas.json';
import LANDINGS from './demo/landings.json';

/*
 * Navegar la tienda en la Tienda de prueba: las ofertas flash (/ofertas), los
 * nichos (/nichos y /nicho/:slug), la tienda de un vendedor
 * (/tienda-vendedor/:slug) y las landings del builder (/:slug).
 *
 * Qué es real y qué es de ejemplo:
 *  - Las ofertas y los nichos son DE EJEMPLO: hoy flashOffers y niches están
 *    vacías en wala.pe (el chip "Sin ofertas (como hoy)" muestra lo real).
 *    Los productos a los que apuntan sí son reales (demo/tienda.json).
 *  - El vendedor "WALA" es el único real de vendors (sin productos ni logo);
 *    el otro vendedor es de ejemplo, con los productos reales de MUSSA.
 *  - Las landings son reales: landingPages + pages/{slug} y los productos de
 *    esas marcas (demo/landings.json).
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
const POR_PAGINA = 12;

/** Fecha AAAA-MM-DD (Lima) dentro de `dias` días. */
const enDias = (dias) => {
  const d = new Date(`${limaTodayStr()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const TODOS = [...TIENDA.productos, ...INICIO.productos.ofertas, ...INICIO.productos.nuevos, ...INICIO.productos.destacados];
const PRODUCTO = new Map(TODOS.map((p) => [p.id, p]));
const LUFFY = TIENDA.productos.find((p) => p.name.includes('Luffy')) || TIENDA.productos[0];
const UNIVERSITARIO = INICIO.productos.ofertas[0];

/* Ofertas de ejemplo con los mismos campos que flashOffers (las fechas como
   las guarda el admin: 'AAAA-MM-DD'). La última ya terminó: no se muestra. */
const OFERTAS_EJEMPLO = [
  { id: 'o1', title: 'Casacas de One Piece', productId: LUFFY.id, discountPct: 10, startsAt: enDias(-3), endsAt: enDias(2), active: true, order: 1 },
  { id: 'o2', title: 'Polo Universitario · 100 años', productId: UNIVERSITARIO.id, discountPct: 24, startsAt: enDias(-1), endsAt: enDias(0), active: true, order: 2 },
  { id: 'o3', title: 'Envío gratis desde S/ 80', discountPct: 15, startsAt: enDias(-5), endsAt: enDias(20), active: true, order: 3 },
  { id: 'o4', title: 'Black Friday Walá', discountPct: 30, startsAt: '2026-11-27', endsAt: '2026-11-30', active: true, order: 4 },
  { id: 'o5', title: 'Fiestas Patrias', discountPct: 20, startsAt: '2026-07-20', endsAt: '2026-07-31', active: true, order: 5 },
];

export const ESTADOS_OFERTAS = [
  ['vacia', 'Sin ofertas (como hoy)'],
  ['abierto', 'Cofre ya abierto hoy'],
  ['falla', 'El cofre falla'],
  ['error', 'Error al cargar'],
  ['cargando', 'Cargando'],
];

export function OfertasDemo({ sesion = true, estados = [], monedas = 0, onMonedas, toast }) {
  const ofertas = useMemo(() => ofertasVigentes(
    OFERTAS_EJEMPLO.map((o) => ofertaDesdeFirestore(o, { producto: PRODUCTO.get(o.productId) })),
  ), []);
  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('error')) estado = 'error';
  return (
    <PaginaOfertas
      key={estados.join()}
      estado={estado}
      sesion={sesion}
      ofertas={estados.includes('vacia') ? [] : ofertas}
      onReintentar={() => toast?.({ tipo: 'info', titulo: 'Volviendo a cargar las ofertas', duracion: 1800 })}
      cofre={{
        abiertoHoy: estados.includes('abierto'),
        hasta: new Date(Date.now() + msHastaMananaLima()).toISOString(),
        onAbrir: async (boton) => {
          await espera(900); // lo que tarda openDailyChestSecure
          if (estados.includes('falla')) throw new Error('Error al abrir el cofre diario. Inténtalo en un momento.');
          const premio = 12;
          volarMonedasGanadas(boton, premio);
          onMonedas?.(premio);
          return { premio, saldo: monedas + premio };
        },
      }}
    />
  );
}

/* ── Nichos ── */

const deMarca = (nombre) => {
  const m = MARCAS.find((x) => x.name === nombre);
  return TIENDA.productos.filter((p) => p.brandId === m?.id);
};
const foto = (p) => (p ? tarjetaDesdeProducto(p).imagen : undefined);

/* Nichos de ejemplo con los campos de niches. "regala-con-amor" es el nicho
   por defecto de verdad (DEFAULT_NICHE_ID): hoy todos los productos caen ahí. */
const NICHOS_EJEMPLO = [
  { id: 'n1', slug: 'regala-con-amor', name: 'Regala con amor', type: 'general', order: 1, active: true, productos: TIENDA.productos, imageUrl: foto(TIENDA.productos[3]) },
  { id: 'n2', slug: 'anime', name: 'Anime y series', type: 'general', order: 2, active: true, productos: deMarca('Con Amor Geeks'), imageUrl: foto(deMarca('Con Amor Geeks')[0]) },
  { id: 'n3', slug: 'parejas', name: 'Para parejas', type: 'personalizados', order: 3, active: true, productos: deMarca('Con Amor Parejas') },
  { id: 'n4', slug: 'relojes', name: 'Relojes y accesorios', type: 'general', order: 4, active: true, productos: deMarca('Yoryo') },
  { id: 'n5', slug: 'oculto', name: 'Nicho inactivo', type: 'general', order: 5, active: false, productos: [] },
];

/* Vendedores: WALA es el real (sin slug, logo ni productos); el otro, de ejemplo. */
const MUSSA = MARCAS.find((x) => x.name === 'MUSSA');
const VENDEDORES = [
  { id: 's3Tti2DCqMz6gTLihH1Y', name: 'WALA', productos: [] },
  { id: 'v-mussa', slug: 'mussa', name: 'MUSSA', logoUrl: MUSSA?.logoUrl, productos: deMarca('MUSSA') },
];

export const VISTAS_NAVEGAR = [
  ['Todos los nichos', '/nichos'],
  ['Un nicho', '/nicho/regala-con-amor'],
  ['Nicho sin productos', '/nicho/relojes-vacio'],
  ['Un vendedor', '/tienda-vendedor/mussa'],
  ['WALA (el vendedor real)', '/tienda-vendedor/s3Tti2DCqMz6gTLihH1Y'],
];

export const ESTADOS_NAVEGAR = [
  ['noEncontrado', 'No encontrado'],
  ['vacia', 'Sin nichos'],
  ['cargando', 'Cargando'],
];

export function NavegarDemo({ ruta = '/nichos', estados = [], catalogo, onAgregar }) {
  const [paginas, setPaginas] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);
  const cargando = estados.includes('cargando') ? 'cargando' : undefined;
  if (ruta === '/nichos') {
    const nichos = estados.includes('vacia') ? [] : NICHOS_EJEMPLO
      .filter((n) => n.active !== false)
      .map((n) => nichoDesdeFirestore(n, { cuenta: n.productos.length }));
    return <PaginaNichos key={estados.join()} estado={cargando} nichos={nichos} />;
  }
  const [, tipoRuta, slug] = ruta.split('/');
  const vendedor = tipoRuta === 'tienda-vendedor';
  const doc = vendedor
    ? VENDEDORES.find((v) => v.slug === slug || v.id === slug)
    : slug === 'relojes-vacio' ? { ...NICHOS_EJEMPLO[3], name: 'Relojes de pared', productos: [] } : NICHOS_EJEMPLO.find((n) => n.slug === slug || n.id === slug);
  const lista = doc?.productos || [];
  const cargarMas = async () => {
    setCargandoMas(true);
    await espera(500);
    setPaginas((n) => n + 1);
    setCargandoMas(false);
  };
  return (
    <PaginaColeccion
      key={`${ruta}-${estados.join()}`}
      tipo={vendedor ? 'vendedor' : 'nicho'}
      estado={cargando || (!doc || estados.includes('noEncontrado') ? 'noEncontrado' : undefined)}
      titulo={doc?.name}
      imagen={vendedor ? doc?.logoUrl : doc?.imageUrl}
      total={lista.length}
      productos={lista.slice(0, paginas * POR_PAGINA)}
      hayMas={lista.length > paginas * POR_PAGINA}
      onCargarMas={cargarMas}
      cargandoMas={cargandoMas}
      catalogo={catalogo}
      onAgregar={onAgregar}
    />
  );
}

/* ── Landings del builder (/:slug) ── */

export const LANDINGS_DEMO = LANDINGS.landings;
export const VISTAS_LANDING = LANDINGS.landings.map((l) => [l.titulo, `/${l.slug}`]);

/**
 * Lo que la página de una landing necesita, como lo arma TiendaPage con
 * pageBrandIdOverride: los productos de esa marca repartidos por sección y
 * las categorías que usan.
 */
export function datosLanding(slug) {
  const l = LANDINGS.landings.find((x) => x.slug === slug) || LANDINGS.landings[0];
  const productos = l.productos;
  const usadas = new Set(productos.flatMap((p) => p.categories || []));
  const categorias = TIENDA.categorias.filter((c) => usadas.has(c.id)).map((c) => ({
    categoryId: c.id, name: c.name, imageUrl: c.imageUrl, cuenta: productos.filter((p) => (p.categories || []).includes(c.id)).length,
  }));
  const porCategoria = Object.fromEntries(categorias.map((c) => [c.categoryId, productos.filter((p) => (p.categories || []).includes(c.categoryId))]));
  return {
    landing: l,
    categorias,
    productos: {
      destacados: productos.filter((p) => p.featured === true).sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0)),
      ofertas: productos.filter((p) => Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price)),
      nuevos: productos,
      porCategoria,
      todos: productos,
    },
  };
}
