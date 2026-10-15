import React, { useState } from 'react';
import {
  PaginaSorteo, PaginaSuscripcionSorteo, PaginaSuscripciones, PaginaRegalosConAmor, PaginaEnlaces, tarjetaDesdeProducto,
} from './kit';
import INICIO from './demo/inicio.json';
import MARCAS from './demo/marcas.json';
import CAMPANAS from './demo/campanas.json';

/*
 * Sorteos y campañas en la Tienda de prueba: el sorteo (/sorteos), el sorteo
 * por suscripción (/suscrito-sorteo), la suscripción de regalos
 * (/suscripciones), Regalos con amor (/regalos-con-amor) y una página de
 * enlaces (/l/:slug). La invitación (/invitar/:código) es el aviso de arriba
 * sobre el registro (DemoTienda).
 *
 * Qué es real y qué es de ejemplo:
 *  - La página de enlaces es la real (link_pages "sorteos-y-atencion").
 *  - Regalos con amor usa sus textos, fotos, reseñas, video y mapa reales
 *    (public/diseno, public/regalos-con-amor); a las reseñas se les quitaron
 *    los emojis.
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
  ['Regalos con amor', '/regalos-con-amor'],
  ['Link en bio', `/l/${CAMPANAS.enlaces.slug}`],
  ['Invitar (/invitar/ISAAC7K)', '/invitar/ISAAC7K'],
];

export const ESTADOS_CAMPANAS = {
  '/sorteos': [['participando', 'Ya participa'], ['pagado', 'Con tickets'], ['cerrado', 'Cerrado'], ['gane', 'Ganó'], ['app', 'Solo desde la app'], ['vacio', 'Sin sorteo'], ['error', 'Error'], ['cargando', 'Cargando']],
  '/suscrito-sorteo': [['suscrito', 'Ya suscrito'], ['pendiente', 'PayPal queda pendiente'], ['noDisponible', 'No disponible'], ['cargando', 'Cargando']],
  '/suscripciones': [['cargando', 'Cargando']],
  '/regalos-con-amor': [['cargando', 'Cargando']],
  enlaces: [['noDisponible', 'No disponible'], ['cargando', 'Cargando']],
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

/* Regalos con amor: lo real de pages/NuevosUsuariosPage.jsx (sin emojis en las reseñas). */
const sinEmojis = (t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}/gu, '').replace(/\s+([.!?,])/g, '$1').trim();
const RESENAS = [
  ['Lima, PE', '12/05/2026', 'Un detalle muy especial', 'Pedimos poleras para aniversario y nos sorprendieron muchísimo. La impresión se ve elegante y resistente. Y de regalo nos dieron unas pulseras que brillan en la oscuridad ☕❤️'],
  ['Arequipa, PE', '08/05/2026', 'Calidad Premium', 'Los gorros personalizados quedaron increíbles. Son cómodos, modernos y el bordado se ve de muy buena calidad. Mi novio y yo los usamos todos los días. ¡Nos preguntan dónde los compramos!'],
  ['Cusco, PE', '01/05/2026', 'Ideal para fans de series y dibujos', 'Pedí una casaca temática y literalmente todos me preguntan dónde la compré. Los acabados están muy bien hechos y el diseño se ve igual que en las imágenes. La taza de regalo fue un plus genial.'],
  ['Trujillo, PE', '25/04/2026', '¡Nos encantó como pareja!', 'Pedimos las 2 poleras personalizadas y superaron nuestras expectativas. La tela es suave, cómoda y el diseño quedó exactamente como lo imaginábamos. Se nota mucho el cuidado en los detalles y la impresión tiene colores muy vivos. Sin duda, un regalo perfecto para parejas. 💕'],
  ['Piura, PE', '15/04/2026', 'Perfecto para sorprender a tu persona especial', 'Compramos el conjunto personalizado y fue un acierto total. La calidad es excelente y se siente muy cómodo al usarlo. Además, llegó súper bien presentado, ideal para regalo. ¡Ya queremos pedir otro diseño!'],
  ['Ica, PE', '02/04/2026', 'Mucho mejor de lo que esperaba', 'Los polos personalizados quedaron hermosos. Las fotos y nombres se ven nítidos y el material no da calor. Mi pareja y yo quedamos fascinados porque además combina perfecto para salir juntos. 😍'],
  ['Lima, PE', '28/03/2026', 'Brutal para fans del anime', 'La casaca personalizada superó totalmente mis expectativas. Los colores del diseño se ven increíbles y la tela es cómoda y abrigadora. Además, vino con una taza de regalo que está demasiado buena. ¡Se nota que está hecha para verdaderos geeks! 🔥'],
  ['Arequipa, PE', '15/03/2026', 'Perfecto para cualquier otaku', 'Compré un polo de anime y quedé fascinado con la calidad de impresión. Los detalles del personaje se ven súper nítidos y no se despintan al lavar. Encima me enviaron un mouse pad de regalo. ¡100% recomendado!'],
].map(([lugar, fecha, titulo, texto], k) => ({ foto: `/regalos-con-amor/testimonios/testi${k + 1}.jpeg`, lugar, fecha, titulo, texto: sinEmojis(texto) }));

const REGALOS = {
  imagenFondo: '/diseno/1920jpg.jpg',
  imagenAbrazos: '/diseno/abrazos.png',
  video: 'https://www.youtube.com/watch?v=eodAZJiI2-E',
  antesDespues: [
    { rotulo: 'Antes', fotos: ['/diseno/tiempo/antes-1.jpeg', '/diseno/tiempo/antes-2.jpeg'] },
    { rotulo: '5 años después', fotos: ['/diseno/tiempo/despues-1.jpeg', '/diseno/tiempo/despues-2.jpeg'] },
  ],
  marcas: [['Walá', '/diseno/wala 900x900.png'], ['Con Amor Familia', '/familia.png'], ['Con Amor Geeks', '/geek.png'], ['Con Amor Deportes', '/deporte.png']].map(([name, imageUrl]) => ({ name, imageUrl })),
  resenas: RESENAS,
  mapa: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d975.8504224873767!2d-77.06130106375515!3d-11.94666653232308!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105d1f845a69fad%3A0x9087d0a48380741b!2sCon%20Amor%20Market!5e0!3m2!1ses-419!2spe!4v1778832509730!5m2!1ses-419!2spe',
  horario: 'Lunes a viernes, de 9 a. m. a 6 p. m.',
  fotosTienda: ['/diseno/tienda/tienda-1.jpeg', '/diseno/tienda/tienda-2.jpeg', '/diseno/tienda/tienda-3.jpeg'],
  urlApp: 'https://play.google.com/store/apps/details?id=com.wala.tienda',
  bono: 15,
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
  if (ruta === '/regalos-con-amor') return <PaginaRegalosConAmor contenido={REGALOS} />;
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

