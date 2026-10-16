import React, { useState } from 'react';
import {
  PaginaSorteo, PaginaSuscripcionSorteo, PaginaSuscripciones, PaginaInvitacion, PaginaEnlaces, tarjetaDesdeProducto,
} from './kit';
import INICIO from './demo/inicio.json';
import MARCAS from './demo/marcas.json';
import CAMPANAS from './demo/campanas.json';

/*
 * Sorteos y campañas en la Tienda de prueba: el sorteo (/sorteos), el sorteo
 * por suscripción (/suscrito-sorteo), la suscripción de regalos
 * (/suscripciones), la invitación (/invitar/:código: cómo debe verse; hoy la
 * tienda lleva directo al registro con el aviso de arriba) y una página de
 * enlaces (/l/:slug, sola, sin la cabecera ni el pie de la tienda).
 * Regalos con amor (/regalos-con-amor) salió del kit el 2026-10-16: sigue en
 * la tienda (NuevosUsuariosPage), sin tocar.
 *
 * Qué es real y qué es de ejemplo:
 *  - La página de enlaces es la real (link_pages "sorteos-y-atencion").
 *  - Suscripciones son los textos reales (la página no lee datos).
 *  - El sorteo y la campaña por suscripción son DE EJEMPLO: en wala.pe hoy
 *    hay un solo sorteo, de prueba, y ninguna campaña por suscripción. Las
 *    fotos son productos reales.
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
const foto = (p) => tarjetaDesdeProducto(p).imagen;
const { destacados = [], nuevos = [] } = INICIO.productos;
const dentroDe = (dias) => new Date(Date.now() + dias * 86400000).toISOString();

export const VISTAS_CAMPANAS = [
  ['Sorteo', '/sorteos'],
  ['Sorteo por suscripción', '/suscrito-sorteo'],
  ['Suscripciones', '/suscripciones'],
  ['Link en bio', `/l/${CAMPANAS.enlaces.slug}`],
  ['Invitar (/invitar/ISAAC7K)', '/invitar/ISAAC7K'],
];

export const ESTADOS_CAMPANAS = {
  '/sorteos': [['participando', 'Ya participa'], ['pagado', 'Con tickets'], ['cerrado', 'Cerrado'], ['gane', 'Ganó'], ['app', 'Solo desde la app'], ['vacio', 'Sin sorteo'], ['error', 'Error'], ['cargando', 'Cargando']],
  '/suscrito-sorteo': [['suscrito', 'Ya suscrito'], ['pendiente', 'PayPal queda pendiente'], ['noDisponible', 'No disponible'], ['cargando', 'Cargando']],
  '/suscripciones': [['cargando', 'Cargando']],
  enlaces: [['noDisponible', 'No disponible'], ['cargando', 'Cargando']],
  invitar: [['conCuenta', 'Ya tiene cuenta'], ['aceptada', 'Ya recibió el bono'], ['invalida', 'Link no válido'], ['cargando', 'Cargando']],
};

/* Sorteo de ejemplo (mismos campos que sorteos, ya traducidos para la página). */
const SORTEO = {
  premio: destacados[0]?.name || 'Una casaca personalizada',
  imagen: foto(destacados[0] || {}),
  descripcion: 'Participa gratis: sorteamos 3 casacas entre todas las personas inscritas.',
  tipo: 'gratis',
  precioTicket: 5,
  moneda: 'PEN',
  numGanadores: 3,
  participantes: 1284,
  reglas: { compartir: true, referido: true, appExtra: true },
  ganadores: [{ id: 'g1', nombre: 'Lucía Ramos' }, { id: 'yo', nombre: 'Isaac Castro' }, { id: 'g3', nombre: 'Diego Paredes' }],
};

/* Campaña por suscripción de ejemplo. */
const CAMPANA = {
  titulo: 'Suscrito y con suerte',
  descripcion: 'Suscríbete con cobro automático y participa cada mes por premios de Walá y de nuestras marcas aliadas.',
  suscriptores: 312,
  planes: [
    { id: 'mensual', nombre: 'Mensual', intervalo: 'Cada mes', meses: 1, precio: 19.9, precioUsd: 5.5, chances: 1, beneficios: ['1 chance en cada sorteo', 'Descuentos de marcas aliadas'] },
    { id: 'trimestral', nombre: 'Trimestral', intervalo: 'Cada 3 meses', meses: 3, precio: 49.9, precioUsd: 13.5, chances: 4, beneficios: ['4 chances por ciclo', 'Descuentos de marcas aliadas', 'Envío gratis en un pedido'], destacado: true },
    { id: 'anual', nombre: 'Anual', intervalo: 'Cada año', meses: 12, precio: 179, precioUsd: 48, chances: 18, beneficios: ['18 chances por ciclo', 'Descuentos de marcas aliadas', 'Un regalo sorpresa al año'] },
  ],
  premios: [destacados[1], nuevos[0], nuevos[2]].filter(Boolean).map((p) => ({ nombre: p.name, imagen: foto(p) })),
  ganadores: [
    { id: 'w1', nombre: 'Mariana Vega', premio: 'Casaca Demon Slayer', fecha: 'septiembre' },
    { id: 'w2', nombre: 'Andrés Salas', premio: 'Polo Universitario', fecha: 'agosto' },
  ],
  aliados: MARCAS.slice(0, 4).map((m, k) => ({
    id: m.id, marca: m.name, imagen: m.logoUrl, titulo: ['En toda la tienda', 'En casacas', 'En tu primera compra', 'En relojes'][k],
    descuento: ['15% de descuento', '10% de descuento', 'S/ 20 de regalo', '2x1'][k], categoria: ['Ropa', 'Ropa', 'Regalos', 'Accesorios'][k], ubicacion: k === 2 ? 'Lima' : undefined,
  })),
};

/* La página de enlaces real, con los nombres del kit. */
const ENLACES = {
  titulo: CAMPANAS.enlaces.titulo,
  descripcion: CAMPANAS.enlaces.descripcion,
  avatar: CAMPANAS.enlaces.avatarUrl,
  redes: (CAMPANAS.enlaces.redes || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, url: r.url, icono: r.iconUrl })),
  botones: (CAMPANAS.enlaces.botones || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((b) => ({ id: b.id, titulo: b.titulo, url: b.url, imagen: b.thumbnailUrl })),
  diseno: CAMPANAS.enlaces.diseno,
};

export function CampanasDemo({ ruta = VISTAS_CAMPANAS[0][1], sesion = true, usuario, estados = [], toast }) {
  const cargando = estados.includes('cargando') ? 'cargando' : undefined;
  const avisar = (titulo, texto) => toast?.({ tipo: 'exito', titulo, texto, duracion: 2400 });

  if (ruta.startsWith('/l/')) {
    return <PaginaEnlaces estado={cargando || (estados.includes('noDisponible') ? 'noDisponible' : undefined)} pagina={ENLACES} onClic={(b) => avisar('Clic contado', b.titulo || b.nombre || b.tipo)} />;
  }
  if (ruta === '/suscripciones') return <PaginaSuscripciones />;
  if (ruta.startsWith('/invitar/')) {
    const estado = cargando || ['conCuenta', 'aceptada', 'invalida'].find((e) => estados.includes(e)) || 'nueva';
    const codigo = ruta.split('/')[2] || '';
    // "Crear mi cuenta" lleva al registro con la invitación, como InvitarPage (?ref=…&tipo=invitacion).
    return <PaginaInvitacion nombre={usuario?.nombre?.split(' ')[0] || 'Isaac'} estado={estado} urlRegistro={`/registro?ref=${codigo}&tipo=invitacion`} urlLogin={`/login?ref=${codigo}&tipo=invitacion`} />;
  }
  if (ruta === '/suscrito-sorteo') return <SuscripcionDemo key={estados.join()} sesion={sesion} usuario={usuario} estados={estados} cargando={cargando} avisar={avisar} />;
  return <SorteoDemo key={`${sesion}-${estados.join()}`} sesion={sesion} usuario={usuario} estados={estados} cargando={cargando} avisar={avisar} />;
}

function SorteoDemo({ sesion, usuario, estados, cargando, avisar }) {
  const cerrado = estados.includes('cerrado') || estados.includes('gane');
  const pagado = estados.includes('pagado');
  const [participacion, setParticipacion] = useState(estados.includes('participando') || estados.includes('gane') ? { tickets: pagado ? 3 : 1, chances: pagado ? 3 : 2, compartio: false } : null);
  let estado = cargando;
  if (!estado && estados.includes('vacio')) estado = 'vacio';
  if (!estado && estados.includes('error')) estado = 'error';
  return (
    <PaginaSorteo
      estado={estado}
      sesion={sesion}
      yo={estados.includes('gane') ? 'yo' : 'otra-persona'}
      sorteo={{
        ...SORTEO,
        tipo: pagado ? 'pagado' : 'gratis',
        hasta: dentroDe(4.3),
        cerrado,
        ganadores: cerrado ? SORTEO.ganadores : [],
        reglas: { ...SORTEO.reglas, appObligatorio: estados.includes('app') },
      }}
      participacion={participacion}
      urlInvitacion={`https://www.wala.pe/sorteos?ref=KS-7Q2M9X`}
      datosIniciales={sesion && usuario ? { nombre: usuario.nombre, correo: usuario.email, tipoDocumento: 'DNI', documento: '45879632', telefono: '987654321' } : {}}
      onParticipar={async () => {
        await espera(900); // participarSorteoGratis
        setParticipacion({ tickets: 1, chances: 2, compartio: false });
        avisar('¡Ya estás participando!', 'Te avisamos si ganas.');
      }}
      onComprar={async ({ cantidad }) => {
        await espera(700); // comprarTicketSorteoSecure
        return { monto: cantidad * SORTEO.precioTicket, moneda: 'PEN' };
      }}
      onPagarTarjeta={async () => {
        await espera(1200);
        setParticipacion((p) => ({ tickets: (p?.tickets || 0) + 1, chances: (p?.chances || 0) + 1, compartio: p?.compartio }));
        avisar('¡Tus tickets ya están registrados!');
      }}
      onPagarPaypal={async () => {
        await espera(1200);
        avisar('¡Tus tickets ya están registrados!');
      }}
      onCompartir={async () => {
        await espera(500); // sumarChanceCompartir
        setParticipacion((p) => ({ ...p, chances: (p?.chances || 1) + 1, compartio: true }));
        avisar('¡Sumaste 1 chance por compartir!');
      }}
    />
  );
}

function SuscripcionDemo({ sesion: sesionInicial, usuario, estados, cargando, avisar }) {
  const [sesion, setSesion] = useState(sesionInicial);
  const [suscripcion, setSuscripcion] = useState(estados.includes('suscrito')
    ? { estado: 'activo', plan: 'Trimestral · cada 3 meses', metodo: 'Tarjeta (Culqi)', vigente: '14 de enero de 2027', proximo: '14 de enero de 2027', chances: 8 }
    : null);
  const pendiente = estados.includes('pendiente');
  return (
    <PaginaSuscripcionSorteo
      estado={cargando || (estados.includes('noDisponible') ? 'noDisponible' : undefined)}
      campana={CAMPANA}
      sesion={sesion}
      usuario={usuario}
      suscripcion={suscripcion}
      recibos={suscripcion ? [{ id: 'r1', fecha: '14 de octubre de 2026', monto: 'S/ 49.90' }, { id: 'r2', fecha: '14 de julio de 2026', monto: 'S/ 49.90' }] : []}
      onGoogle={async () => { await espera(700); setSesion(true); }}
      onPagarTarjeta={async ({ plan }) => {
        await espera(1300); // crearSuscripcionCulqi
        setSuscripcion({ estado: 'activo', plan: `${plan.nombre} · ${plan.intervalo.toLowerCase()}`, metodo: 'Tarjeta (Culqi)', vigente: 'dentro de un ciclo', proximo: 'dentro de un ciclo', chances: plan.chances });
        avisar('¡Suscripción activada!', 'Ya participas en los sorteos.');
        return {};
      }}
      onPagarPaypal={async ({ plan }) => {
        await espera(1300); // crearSuscripcionPaypal + confirmarSuscripcionPaypal
        if (pendiente) return { pendiente: true };
        setSuscripcion({ estado: 'activo', plan: `${plan.nombre} · ${plan.intervalo.toLowerCase()}`, metodo: 'PayPal', vigente: 'dentro de un ciclo', proximo: 'dentro de un ciclo', chances: plan.chances });
        avisar('¡Suscripción activada!', 'Ya participas en los sorteos.');
        return {};
      }}
      onCancelar={async () => {
        await espera(800); // cancelarSuscripcion
        setSuscripcion((x) => ({ ...x, estado: 'cancelado' }));
        avisar('Tu suscripción fue cancelada', 'Sigues vigente hasta el fin del periodo pagado.');
      }}
    />
  );
}

