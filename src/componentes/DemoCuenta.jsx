import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User, Package, MapPin, Settings, Gift, Ticket, Trophy, Users, Sparkles, Heart, Calendar } from 'lucide-react';
import {
  MarcoCuenta, PaginaCuentaInvitado, PaginaResumenCuenta, PaginaPerfil, PaginaDirecciones, PaginaAjustes, PaginaPedidos,
  PaginaCatalogo, PaginaCupones, PaginaMisiones, PaginaReferidos, PaginaCreaciones, PaginaListaDeseos, PaginaFechas,
  PaginaDetallePedido, HojaPagarSaldo, Boton, enlaceWhatsApp, PaginaEncuesta,
  PaginaLogin, PaginaRegistro, PaginaRecuperar, PaginaCompletarPerfil, PaginaCrear, PaginaComunidad, PaginaCreacion, PaginaVerDiseno, PaginaCombo, PaginaEstudio,
  prendaCrearDesdeProducto, comboCrearDesde, disenoComunidadDesde, fichaCreacionDesde, prendaEstudioDesde,
  PaginaEditor, prendaEditorDesde,
} from './kit';
import { empresa } from '../config/empresa';
import CREAR from './demo/crear.json';
import EDITOR from './demo/editor.json';
import { leerPrendaBase } from '../utils/prendaBase';
import { volarMonedasGanadas } from '../utils/animations';
import { DEPARTAMENTOS, getProvincias } from '../constants/peruUbigeo';
import { distritosSugeridos, lugarLegible } from '../utils/ubicacionErp';

/*
 * "Mi cuenta" de la Tienda de prueba: las páginas de /cuenta dentro de
 * MarcoCuenta (menú lateral en escritorio, accesos en el celular). Los
 * números (C0, C1…) son los de kit/guia/CUENTA.md.
 * Datos inventados (no son de un cliente real); el ubigeo sí es el de la
 * tienda (constants/peruUbigeo y utils/ubicacionErp).
 */

/* Los mismos accesos que useCuentaNavGroups, con el tono del sello por grupo. */
export const GRUPOS_CUENTA_COMPLETO = [
  { titulo: 'Cuenta', tono: 'degradado', items: [
    { to: '/cuenta/perfil', texto: 'Mi perfil', Icono: User },
    { to: '/cuenta/pedidos', texto: 'Mis pedidos', Icono: Package },
    { to: '/cuenta/direcciones', texto: 'Mis direcciones', Icono: MapPin },
    { to: '/cuenta/ajustes', texto: 'Ajustes', Icono: Settings },
  ] },
  { titulo: 'Recompensas', tono: 'oro', items: [
    { to: '/cuenta/catalogo', texto: 'Catálogo de recompensas', Icono: Gift },
    { to: '/cuenta/cupones', texto: 'Mis cupones', Icono: Ticket, cuenta: 2 },
    { to: '/cuenta/misiones', texto: 'Misiones', Icono: Trophy },
    { to: '/cuenta/referidos', texto: 'Mis referidos', Icono: Users },
  ] },
  { titulo: 'Personalización', tono: 'rosa', items: [
    { to: '/cuenta/creaciones', texto: 'Mis creaciones', Icono: Sparkles },
    { to: '/cuenta/wishlist', texto: 'Lista de deseos', Icono: Heart },
    { to: '/cuenta/fechas-importantes', texto: 'Fechas importantes', Icono: Calendar },
  ] },
];

/** Módulos de /cuenta armados en la demo, con su número de la guía. */
export const MODULOS_CUENTA = [
  { ruta: '/cuenta', texto: 'Resumen', n: 'C1', componente: 'PaginaResumenCuenta' },
  { ruta: '/cuenta/perfil', texto: 'Mi perfil', n: 'C2', componente: 'PaginaPerfil' },
  { ruta: '/cuenta/pedidos', texto: 'Mis pedidos', n: 'C3', componente: 'PaginaPedidos (P2)' },
  { ruta: '/cuenta/pedidos/PD-20455', texto: 'Detalle de compra', n: 'C3·d', componente: 'PaginaDetallePedido' },
  { ruta: '/cuenta/direcciones', texto: 'Mis direcciones', n: 'C4', componente: 'PaginaDirecciones' },
  { ruta: '/cuenta/ajustes', texto: 'Ajustes', n: 'C5', componente: 'PaginaAjustes' },
  { ruta: '/cuenta/catalogo', texto: 'Catálogo', n: 'C6', componente: 'PaginaCatalogo' },
  { ruta: '/cuenta/cupones', texto: 'Mis cupones', n: 'C7', componente: 'PaginaCupones' },
  { ruta: '/cuenta/misiones', texto: 'Misiones', n: 'C8', componente: 'PaginaMisiones' },
  { ruta: '/cuenta/referidos', texto: 'Mis referidos', n: 'C9', componente: 'PaginaReferidos' },
  { ruta: '/cuenta/creaciones', texto: 'Mis creaciones', n: 'C10', componente: 'PaginaCreaciones' },
  { ruta: '/cuenta/wishlist', texto: 'Lista de deseos', n: 'C11', componente: 'PaginaListaDeseos' },
  { ruta: '/cuenta/fechas-importantes', texto: 'Fechas importantes', n: 'C12', componente: 'PaginaFechas' },
];

/** Estados para probar (chips de la demo). */
export const ESTADOS_CUENTA = [
  ['incompleto', 'Perfil incompleto'],
  ['vacio', 'Sin datos'],
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
];

export const LUGARES = {
  departamentos: DEPARTAMENTOS,
  provincias: getProvincias,
  distritos: (d) => distritosSugeridos({ country: d.pais, city: d.ciudad, department: d.departamento, province: d.provincia }),
  legible: (d) => lugarLegible({ country: d.pais, city: d.ciudad, district: d.distrito, department: d.departamento, province: d.provincia }),
};

export const DIRECCIONES = [
  {
    id: 'dir-1', principal: true, nombre: 'Isaac Castro', tipoDocumento: 'DNI', documento: '45871236', telefono: '987654321',
    pais: 'PE', ciudad: 'Lima', departamento: '', provincia: '', distrito: 'Miraflores', direccion: 'Av. Larco 1150, dpto. 502 (frente al parque)',
  },
  {
    id: 'dir-2', principal: false, nombre: 'María Castro', tipoDocumento: 'DNI', documento: '41236587', telefono: '956123478',
    pais: 'PE', ciudad: 'Provincias', departamento: 'Arequipa', provincia: 'Arequipa', distrito: 'Yanahuara', direccion: 'Calle Jerusalén 214, casa de rejas verdes',
  },
];

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* Recompensas, cupones, misiones y referidos de ejemplo (mismos campos que
   rewardsCatalog, userCoupons, getDailyMissionsSecure y los referidos, ya
   pasados por los adaptadores). La foto de la taza es de un producto real. */
const recompensasDemo = (fotos) => [
  { id: 'r1', titulo: 'Cupón de descuento', descripcion: 'Para cualquier prenda de la tienda, en tu próxima compra.', beneficio: '10% de descuento', costo: 30 },
  { id: 'r2', titulo: 'Envío gratis en Lima', descripcion: 'Tu próximo pedido llega sin costo de envío.', beneficio: 'Envío gratis', costo: 40 },
  { id: 'r3', titulo: fotos[0]?.nombre || 'Taza de regalo', descripcion: 'Te la mandamos con tu próximo pedido.', imagen: fotos[0]?.imagen, beneficio: 'De regalo', costo: 120 },
  { id: 'r4', titulo: fotos[1]?.nombre || 'Polera de regalo', descripcion: 'Te lo mandamos con tu próximo pedido.', imagen: fotos[1]?.imagen, beneficio: 'De regalo', costo: 250 },
];

const CUPONES = [
  { id: 'c1', texto: '15% en tu próxima compra', codigo: 'RULETA-8KQ2', origen: 'ruleta', estado: 'activo', vence: '31 de octubre' },
  { id: 'c2', texto: 'Envío gratis en Lima', codigo: 'ENVIO-4XP9', origen: 'recompensa', estado: 'activo', vence: '15 de noviembre' },
  { id: 'c3', texto: '10% de descuento', codigo: 'WALA-2TM7', origen: 'recompensa', estado: 'usado' },
  { id: 'c4', texto: 'S/ 10 de descuento', codigo: 'RULETA-1ZB3', origen: 'ruleta', estado: 'caducado', vence: '30 de septiembre' },
];

const MISIONES = [
  { id: 'm1', titulo: 'Visita el catálogo de recompensas', descripcion: 'Mira qué puedes canjear con tus monedas.', recompensa: 2, completada: true },
  { id: 'm2', titulo: 'Revisa tus cupones', descripcion: 'Que no se te venza ninguno.', recompensa: 1, accion: { texto: 'Ir a Mis cupones', url: '/cuenta/cupones' } },
  { id: 'm3', titulo: 'Juega en la Zona Arcade', descripcion: 'Una partida de cualquier juego.', recompensa: 2, accion: { texto: 'Ir a Minijuegos', url: '/minijuegos' } },
  { id: 'm4', titulo: 'Cuéntanos qué te gusta', descripcion: 'Marca un favorito para que te recomendemos mejor.', recompensa: 1 },
];

const gruposReferidosDemo = (fotos) => [
  {
    id: 'invitacion', tipo: 'invitacion', antetitulo: 'Tu invitación', titulo: 'Link de invitación',
    personas: [
      { id: 'p1', nombre: 'Lucía', cuentaNueva: true, compro: true, chips: [{ texto: 'Cuenta nueva', tono: 'violeta' }, { texto: 'En camino', tono: 'aviso' }],
        detalle: `Compró ${fotos[0]?.nombre || 'una taza'} · S/ 89.90 · 9 oct`, ganancia: 15, confirmada: true, reclamo: 'alEntregarse',
        pedido: { etapa: { texto: 'En camino', tono: 'aviso' }, nota: 'Ya salió a reparto.', fecha: '9 de octubre de 2026', total: 'S/ 89.90', productos: [{ nombre: fotos[0]?.nombre || 'Taza', imagen: fotos[0]?.imagen, cantidad: 1 }] } },
      { id: 'p2', nombre: 'Diego', cuentaNueva: true, chips: [{ texto: 'Cuenta nueva', tono: 'violeta' }, { texto: '21 días', tono: 'neutro' }],
        detalle: 'Creó su cuenta y recibió 10 monedas · tiene 21 días para su primera compra', ganancia: 15 },
      { id: 'p3', nombre: '', chips: [{ texto: 'Plazo vencido', tono: 'neutro' }], detalle: 'Entró el 2 oct · no compró a tiempo' },
    ],
  },
  {
    id: 'prod', tipo: 'producto', antetitulo: 'Link del producto', titulo: fotos[1]?.nombre || 'Producto compartido', imagen: fotos[1]?.imagen,
    descripcion: 'Cuenta cualquier compra que hagan en 36 h, no solo este producto.',
    personas: [
      { id: 'p4', nombre: 'Andrea', compro: true, chips: [{ texto: 'Entregado', tono: 'exito' }], detalle: `Compró ${fotos[1]?.nombre || 'una polera'} y 1 más · S/ 154.80 · 3 oct`,
        ganancia: 8, confirmada: true, reclamo: 'listo',
        pedido: { etapa: { texto: 'Entregado', tono: 'exito' }, nota: 'Ya se entregó: puedes reclamar tus monedas.', fecha: '3 de octubre de 2026', total: 'S/ 154.80',
          productos: [{ nombre: fotos[1]?.nombre || 'Polera', imagen: fotos[1]?.imagen, extra: 'Talla M', cantidad: 1 }, { nombre: fotos[2]?.nombre || 'Taza', imagen: fotos[2]?.imagen, cantidad: 1 }] } },
      { id: 'p5', nombre: 'Visitante 2', chips: [{ texto: '5 h 20 min', tono: 'neutro' }], detalle: 'Entró hoy · le quedan 5 h 20 min para comprar' },
    ],
  },
  {
    id: 'anteriores', tipo: 'anteriores', antetitulo: 'Links anteriores', titulo: 'Links de uno por persona',
    descripcion: 'Los links que se generaban uno por persona. Siguen funcionando.', sinAbrir: 2,
    personas: [
      { id: 'p6', nombre: 'Rosa', compro: true, chips: [{ texto: 'Reclamado', tono: 'exito' }], detalle: 'Compró 2 productos · S/ 120.00 · 12 sep', ganancia: 6, confirmada: true },
    ],
  },
];

/* Personalización: creaciones (las fotos de la polera son de la demo del
   estudio), deseos (productos reales) y fechas importantes. */
/* ── Datos reales de Crear (demo/crear.json: prendas base, combos y diseños
   de la comunidad leídos de wala.pe), por los adaptadores del kit. ── */
const PRENDAS_CREAR = CREAR.prendas
  .filter((p) => p.deleted !== true)
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));
const PRENDA_POR_ID = new Map(PRENDAS_CREAR.map((p) => [p.id, p]));
const precioDe = (id) => {
  const p = PRENDA_POR_ID.get(id) || CREAR.combos.find((c) => c.id === id);
  if (!p) return undefined;
  const sale = Number(p.salePrice);
  return sale > 0 && sale < Number(p.price) ? sale : Number(p.price);
};
const FECHAS = ['Guardada hoy', 'Guardada ayer', 'Guardada hace 3 días', 'Guardada hace 5 días', 'Guardada hace 12 días', 'Guardada hace 20 días'];

/** Un diseño real (de la comunidad) como si fuera una creación del cliente. */
const creacionDesdeReal = (d, k) => {
  const { usar, ...base } = disenoComunidadDesde(d);
  const esCombo = d.tipo === 'combo';
  return {
    ...base,
    id: `cr-${d.id}`,
    fecha: FECHAS[k % FECHAS.length],
    precio: precioDe(esCombo ? d.comboId : d.productId),
    combo: esCombo ? String((d.piezas || []).length) : undefined,
    subtitulo: esCombo ? d.comboNombre : undefined,
    comprado: k === 1,
    publicada: k === 0,
    urlEditar: esCombo ? `/combo/${d.comboId}?mio=${d.id}` : `/crear/${d.productId}?designId=${d.id}`,
    urlComprar: esCombo ? `/combo/${d.comboId}?mio=${d.id}` : `/creacion/${d.id}`,
  };
};

const creacionesDemo = () => CREAR.comunidad.map(creacionDesdeReal);

const BORRADORES = CREAR.comunidad.slice(-3).map((d, k) => {
  const c = creacionDesdeReal(d, k);
  return {
    id: `b-${d.id}`, nombre: c.nombre, imagen: c.imagen, imagenes: c.imagenes, producto: c.producto, color: c.color, prendaId: c.prendaId,
    subtitulo: c.imagenes ? '1 de 2 prendas con diseño · sin terminar' : undefined,
    fecha: ['Editado hoy', 'Editado ayer', 'Editado hace 2 días'][k], urlEditar: c.urlEditar,
  };
});

/* Pedidos por verificar (coinciden con el documento). */
const POR_VERIFICAR = [
  { ref: 'v1', fecha: '2 oct 2026', fase: 'En producción', mismoCorreo: true },
  { ref: 'v2', fecha: '18 ago 2026', fase: 'Entregado', pistaCorreo: 'i***@hotmail.com' },
];

const RANKING = [
  { codigo: 'MARIA22', compras: 5, monedas: 62 },
  { codigo: 'ISAAC7K', compras: 3, monedas: 31 },
  { codigo: 'LUCHO10', compras: 2, monedas: 20 },
  { codigo: 'ANAWALA', compras: 1, monedas: 15 },
];

/** Un pedido de la lista → el detalle de su compra. */
const detalleDe = (p) => p && ({
  codigo: p.codigo,
  numeroProduccion: p.pasos ? '4512' : undefined,
  fecha: `${p.fecha} de 2026`,
  estado: p.anulado ? { texto: 'Anulado', tono: 'neutro' } : p.estado || { texto: p.pagoPendiente ? 'Por confirmar pago' : 'Pago confirmado', tono: p.pagoPendiente ? 'aviso' : 'violeta' },
  pago: p.pagoPendiente ? { texto: 'Por validar (Yape/Plin/transf.)' } : p.deuda ? { texto: 'Pagaste una parte' } : { texto: 'Pagado con tarjeta (Culqi)', pagado: true },
  produccion: Boolean(p.pasos),
  pasos: p.pasos || ['Pago', 'Pagado', 'En preparación', 'Enviado', 'Entregado'],
  paso: p.paso,
  fechasPasos: Object.fromEntries(Array.from({ length: p.paso + 1 }, (_, i) => [i, `${3 + i} oct`])),
  anulado: p.anulado,
  deuda: p.deuda || 0,
  productos: p.items.map((it, i) => ({ id: it.id || i, nombre: it.nombre, imagen: it.imagen, talla: (it.variante || '').replace('Talla ', ''), personalizado: i === 0 && Boolean(p.pasos), cantidad: it.cantidad, subtotal: it.precio * it.cantidad })),
  direccion: { linea: 'Av. Larco 1150, dpto. 502 (frente al parque)', lugar: 'Miraflores, Lima Metropolitana' },
  resumen: { productos: p.total, envio: p.total >= 150 ? 0 : 12, total: p.total + (p.total >= 150 ? 0 : 12) },
});

/* Los conjuntos por defecto de tienda_encuesta_config (encuestaConfig.js):
   campos de texto con sugerencias del catálogo (sugerenciasPorCampo). */
const CONJUNTOS = [
  { id: 'cat_deportes', nombre: 'Deportes', campos: [
    { id: 'dep_q1', etiqueta: '¿Cuál es su deporte favorito?', sugerencias: ['Fútbol', 'Vóley', 'Básquet', 'Running'] },
    { id: 'dep_q2', etiqueta: '¿De qué equipo es hincha?', sugerencias: ['Alianza Lima', 'Universitario', 'Sporting Cristal', 'Real Madrid', 'Barcelona'] },
  ] },
  { id: 'cat_geek', nombre: 'Geek', campos: [
    { id: 'geek_q1', etiqueta: '¿Cuál es su anime o franquicia favorita?', sugerencias: ['Dragon Ball', 'One Piece', 'Demon Slayer', 'Naruto', 'Jujutsu Kaisen'] },
    { id: 'geek_q2', etiqueta: '¿Quién es su personaje favorito?', sugerencias: ['Goku', 'Vegeta', 'Luffy', 'Zoro', 'Nezuko', 'Tanjiro', 'Itachi Uchiha', 'Kakashi', 'Gojo', 'Rengoku', 'Akaza', 'Inosuke'] },
  ] },
];
const ideasDe = (fotos, desde = 0) => fotos.slice(desde, desde + 2).map((f, k) => ({
  id: `i${desde}${k}`, nombre: f.nombre, imagen: f.imagen, precio: [49.9, 34.9, 59.9][(desde + k) % 3], url: '/producto/x',
  motivo: k ? 'Le gusta el anime' : 'Entra en tu presupuesto',
}));
const personasDemo = (fotos) => [
  { id: 'per1', nombre: 'María', relacion: 'hermanos', genero: 'Femenino', presupuesto: '50a100', gustos: { cat_geek: { geek_q1: 'Demon Slayer', geek_q2: 'Nezuko' } },
    eventos: [{ id: 'e1', tipo: 'Cumpleaños', fecha: '1998-10-20' }],
    festivas: [{ nombre: 'Navidad', fecha: '0000-12-25' }],
    paquete: { total: 84.8, productos: fotos.slice(0, 2).map((f, k) => ({ nombre: f.nombre, imagen: f.imagen, precio: [49.9, 34.9][k], url: '/producto/x' })), quitados: 1 },
    ideas: ideasDe(fotos, 1) },
  { id: 'per2', nombre: 'Carlos', relacion: 'pareja', genero: 'Masculino',
    eventos: [{ id: 'e2', tipo: 'Cumpleaños', fecha: '0000-03-08' }, { id: 'e3', tipo: 'Aniversario', fecha: '2021-11-02' }],
    ideas: ideasDe(fotos, 0), ideasGenerales: true },
];

export function CuentaDemo({
  ruta = '/cuenta', sesion, usuario, monedas, onMonedas, tema, onTema, onCerrarSesion, estados = [], toast, Parte, pedidos = [], fotos = [],
  deseos = [], onAgregar, onIrATienda, recomendados = [], catalogo, onAgregarProducto, esAdmin = false,
}) {
  const incompleto = estados.includes('incompleto');
  const [perfil, setPerfil] = useState({
    nombre: usuario?.nombre, email: usuario?.email, avatar: null, pais: 'PE', tipoDocumento: 'DNI',
    documento: '45871236', telefono: '987654321', cumpleanos: '2001-07-12',
  });
  const [whatsapp, setWhatsapp] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [direcciones, setDirecciones] = useState(DIRECCIONES);
  const [idioma, setIdioma] = useState('es');
  const perfilVisto = incompleto ? { ...perfil, documento: '', telefono: '' } : perfil;
  const vacio = estados.includes('vacio');
  const cargando = estados.includes('cargando');
  const conError = estados.includes('error');
  const listaDirecciones = vacio ? [] : direcciones;
  const [cupones, setCupones] = useState(CUPONES);
  const [misiones, setMisiones] = useState(MISIONES);
  const [grupos, setGrupos] = useState(() => gruposReferidosDemo(fotos));
  const recompensas = useMemo(() => recompensasDemo(fotos), [fotos]);
  const [creaciones, setCreaciones] = useState(() => creacionesDemo());
  const [comunidad, setComunidad] = useState({ d1: 'publicada' });
  const [pagar, setPagar] = useState(null);
  const [reclamadas, setReclamadas] = useState(false);
  const [borradores, setBorradores] = useState(BORRADORES);
  const [listaDeseos, setListaDeseos] = useState(deseos);
  const [personas, setPersonas] = useState(() => personasDemo(fotos));
  const [ganadas, setGanadas] = useState(0);
  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); } catch { /* sin permiso en la demo */ }
    avisar('¡Copiado!', texto, 'info');
  };
  const avisar = useCallback((titulo, texto, tipo = 'exito') => toast({ tipo, titulo, texto, duracion: 2200 }), [toast]);

  const guardarDireccion = useCallback(async (d) => {
    await espera(700);
    setDirecciones((lista) => {
      if (d.id) return lista.map((x) => (x.id === d.id ? { ...x, ...d } : x));
      return [...lista, { ...d, id: `dir-${Date.now().toString(36)}`, principal: lista.length === 0 }];
    });
    avisar('Dirección guardada');
  }, [avisar]);

  const enDetalle = ruta.startsWith('/cuenta/pedidos/');
  const modulo = enDetalle ? MODULOS_CUENTA.find((m) => m.componente === 'PaginaDetallePedido') : (MODULOS_CUENTA.find((m) => m.ruta === ruta) || MODULOS_CUENTA[0]);
  // Publicar en la comunidad: solo quien puede (admins); no un producto que ya no está.
  const conComunidad = (c) => (!esAdmin || c.disponible === false ? undefined : {
    estado: comunidad[c.id] || null,
    onPublicar: async () => { await espera(700); setComunidad((x) => ({ ...x, [c.id]: 'publicada' })); avisar('Publicada en la comunidad'); },
    onActualizar: async () => { await espera(700); avisar('Publicación actualizada'); },
    onRetirar: async () => { await espera(700); setComunidad((x) => ({ ...x, [c.id]: 'retirada' })); avisar('Retirada de la comunidad', undefined, 'info'); },
  });
  const usuarioMarco = useMemo(() => ({ ...usuario, nombre: perfil.nombre, avatar: perfil.avatar }), [usuario, perfil.nombre, perfil.avatar]);

  if (!sesion) {
    return (
      <Parte n={modulo.n} nombre="PaginaCuentaInvitado">
        <PaginaCuentaInvitado pedidos={ruta === '/cuenta/pedidos'} />
      </Parte>
    );
  }

  let pagina;
  if (ruta === '/cuenta/perfil') {
    pagina = (
      <PaginaPerfil
        perfil={perfilVisto}
        monedas={monedas}
        enEspera={50}
        whatsapp={whatsapp}
        onWhatsapp={(v) => { setWhatsapp(v); avisar(v ? 'Te avisaremos de ofertas por WhatsApp' : 'Ya no te enviaremos ofertas por WhatsApp', undefined, 'info'); }}
        onGuardar={async (datos) => { await espera(700); setPerfil((p) => ({ ...p, ...datos })); avisar('Datos actualizados'); }}
        onCambiarFoto={async (archivo) => { setSubiendo(true); await espera(800); setPerfil((p) => ({ ...p, avatar: URL.createObjectURL(archivo) })); setSubiendo(false); }}
        onQuitarFoto={() => setPerfil((p) => ({ ...p, avatar: null }))}
        subiendoFoto={subiendo}
        paises={[{ valor: 'PE', texto: 'Perú', prefijo: '+51' }, { valor: 'CL', texto: 'Chile', prefijo: '+56' }, { valor: 'MX', texto: 'México', prefijo: '+52' }]}
      />
    );
  } else if (enDetalle) {
    const p = pedidos.find((x) => ruta.endsWith(`/${x.codigo}`));
    const detalle = detalleDe(p);
    pagina = (
      <>
        <PaginaDetallePedido
          pedido={detalle}
          noEncontrado={!p}
          cargando={cargando}
          onPagar={() => setPagar(p)}
          pagos={{
            historial: p && !p.pagoPendiente ? [{ monto: detalle.resumen.total - (p.deuda || 0), fecha: `${p.fecha} · 3:12 p. m.` }] : [],
            onBoletas: async () => { await espera(700); return fotos.map((f) => f.imagen).filter(Boolean).slice(0, 2); },
            onFotosEnvio: async () => { await espera(700); return []; },
            monedas: p && p.paso >= (p.pasos?.length || 5) - 1 && !p.anulado ? {
              cantidad: 10, reclamadas,
              onReclamar: async () => { await espera(800); setReclamadas(true); onMonedas?.(10); volarMonedasGanadas(null, 10); avisar('¡Reclamaste 10 monedas!'); },
            } : undefined,
          }}
          whatsapp={[{ texto: 'Consultar estado de mi pedido', url: enlaceWhatsApp(empresa.whatsapp, `Hola, quiero consultar el estado de mi pedido #${p?.codigo}`) }]}
          recomendados={recomendados}
          catalogo={catalogo}
          onAgregar={onAgregarProducto}
        />
        <HojaPagarSaldo
          abierta={Boolean(pagar)}
          onCerrar={() => setPagar(null)}
          monto={pagar?.deuda || pagar?.total || 0}
          tarjeta={<Boton bloque onClick={() => avisar('En la tienda', 'Aquí va el formulario de Culqi o PayPal', 'info')}>Pagar con tarjeta</Boton>}
          yape={{ numero: '987 654 321', nombre: 'Walá Perú' }}
          plin={{ numero: '912 345 678', nombre: 'Walá Perú' }}
          urlComprobante={enlaceWhatsApp(empresa.whatsapp, `Hola, quiero pagar mi saldo pendiente del pedido #${pagar?.codigo}. Adjunto mi comprobante.`)}
        />
      </>
    );
  } else if (ruta === '/cuenta/pedidos') {
    pagina = (
      <>
        <PaginaPedidos
          pedidos={vacio ? [] : pedidos.map((p) => ({ ...p, onPagar: () => setPagar(p) }))}
          porVerificar={vacio ? undefined : {
            pendientes: POR_VERIFICAR,
            correoVerificado: false,
            onEnviarVerificacion: async () => { await espera(800); return { yaVerificado: false }; },
            onYaVerifique: async () => { await espera(800); return false; },
            onVincular: async () => { await espera(900); throw new Error('Ese número de pedido no coincide con ese teléfono. Revísalos e inténtalo de nuevo.'); },
          }}
          cargando={cargando}
          error={conError}
          onReintentar={() => avisar('En la tienda', 'Volvería a pedir tus pedidos', 'info')}
          sinDocumento={incompleto}
          onIrATienda={onIrATienda}
        />
        <HojaPagarSaldo
          abierta={Boolean(pagar)}
          onCerrar={() => setPagar(null)}
          monto={pagar?.deuda || pagar?.total || 0}
          tarjeta={<Boton bloque onClick={() => avisar('En la tienda', 'Aquí va el formulario de Culqi o PayPal', 'info')}>Pagar con tarjeta</Boton>}
          yape={{ numero: '987 654 321', nombre: 'Walá Perú' }}
          plin={{ numero: '912 345 678', nombre: 'Walá Perú' }}
          urlComprobante={enlaceWhatsApp(empresa.whatsapp, `Hola, quiero pagar el pedido #${pagar?.codigo}. Adjunto mi comprobante.`)}
        />
      </>
    );
  } else if (ruta === '/cuenta/direcciones') {
    pagina = (
      <PaginaDirecciones
        direcciones={listaDirecciones}
        cargando={cargando}
        lugares={LUGARES}
        perfil={perfilVisto}
        onGuardar={guardarDireccion}
        onPrincipal={(id) => { setDirecciones((l) => l.map((x) => ({ ...x, principal: x.id === id }))); avisar('Dirección principal actualizada'); }}
        onEliminar={(id) => {
          setDirecciones((l) => {
            const quedan = l.filter((x) => x.id !== id);
            if (quedan.length && !quedan.some((x) => x.principal)) quedan[0] = { ...quedan[0], principal: true };
            return quedan;
          });
          avisar('Dirección eliminada', undefined, 'info');
        }}
      />
    );
  } else if (ruta === '/cuenta/catalogo') {
    pagina = (
      <PaginaCatalogo
        recompensas={vacio ? [] : recompensas}
        saldo={monedas}
        cargando={cargando}
        error={conError}
        onReintentar={() => avisar('En la tienda', 'Volvería a pedir el catálogo', 'info')}
        onCanjear={async (id) => {
          await espera(900);
          const r = recompensas.find((x) => x.id === id);
          onMonedas?.(-r.costo);
          const codigo = `WALA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          setCupones((c) => [{ id: codigo, texto: r.beneficio === 'De regalo' ? r.titulo : r.beneficio, codigo, origen: 'recompensa', estado: 'activo', vence: '30 de noviembre' }, ...c]);
          return { codigo };
        }}
      />
    );
  } else if (ruta === '/cuenta/cupones') {
    pagina = (
      <PaginaCupones
        cupones={vacio ? [] : cupones}
        cargando={cargando}
        error={conError}
        onReintentar={() => avisar('En la tienda', 'Volvería a pedir tus cupones', 'info')}
        onCopiar={copiar}
        urlRuleta="/minijuegos"
      />
    );
  } else if (ruta === '/cuenta/misiones') {
    pagina = (
      <PaginaMisiones
        monedas={monedas}
        xp={180}
        racha={{ dias: 4, hoy: true, ganado: 1 }}
        misiones={vacio ? [] : misiones}
        fecha="14 de octubre"
        cargando={cargando}
        error={conError}
        onCompletar={async (id) => {
          await espera(700);
          const m = misiones.find((x) => x.id === id);
          setMisiones((l) => l.map((x) => (x.id === id ? { ...x, completada: true } : x)));
          onMonedas?.(m.recompensa);
          volarMonedasGanadas(null, m.recompensa);
          return { recompensa: m.recompensa };
        }}
      />
    );
  } else if (ruta === '/cuenta/referidos') {
    pagina = (
      <PaginaReferidos
        ranking={{ items: vacio ? [] : RANKING, cargando }}
        url="https://www.wala.pe/invitar/ISAAC7K"
        codigo="ISAAC7K"
        monedas={monedas}
        resumen={vacio ? {} : { entraron: 6, cuentasNuevas: 2, compras: 3, porReclamar: 1, ganadas: 6 }}
        grupos={vacio ? [{ id: 'invitacion', tipo: 'invitacion', antetitulo: 'Tu invitación', titulo: 'Link de invitación', personas: [] }] : grupos}
        cargando={cargando}
        onCompartir={() => avisar('En el celular', 'Se abriría el menú de compartir del teléfono', 'info')}
        onCopiar={copiar}
        onReclamar={async (id) => {
          await espera(900);
          let n = 0;
          setGrupos((gs) => gs.map((g) => ({ ...g, personas: g.personas.map((p) => {
            if (p.id !== id) return p;
            n = p.ganancia;
            return { ...p, reclamo: undefined, chips: [{ texto: 'Reclamado', tono: 'exito' }] };
          }) })));
          onMonedas?.(n || 8);
          volarMonedasGanadas(null, n || 8);
          avisar(`¡Reclamaste ${n || 8} monedas!`);
        }}
      />
    );
  } else if (ruta === '/cuenta/creaciones') {
    pagina = (
      <PaginaCreaciones
        creaciones={vacio ? [] : creaciones}
        borradores={vacio ? [] : borradores}
        cargando={cargando}
        error={conError}
        onReintentar={() => avisar('En la tienda', 'Volvería a pedir tus creaciones', 'info')}
        onEliminar={async (id) => {
          await espera(700);
          setCreaciones((l) => l.filter((x) => x.id !== id));
          setBorradores((l) => l.filter((x) => x.id !== id));
          avisar(id.startsWith('b') ? 'Borrador eliminado' : 'Creación eliminada', undefined, 'info');
        }}
        onRenombrar={async (id, nombre) => { await espera(500); setCreaciones((l) => l.map((x) => (x.id === id ? { ...x, nombre } : x))); }}
        comunidadPara={esAdmin ? conComunidad : undefined}
      />
    );
  } else if (ruta === '/cuenta/wishlist') {
    pagina = (
      <PaginaListaDeseos
        items={vacio ? [] : listaDeseos}
        cargando={cargando}
        sinCumpleanos
        onQuitar={(id) => { setListaDeseos((l) => l.filter((x) => x.id !== id)); avisar('Quitado de tu lista', undefined, 'info'); }}
        onAgregar={(it) => onAgregar?.(it)}
        onAgregarTodo={async () => {
          await espera(800);
          const n = listaDeseos.filter((x) => x.disponible !== false && !x.regalado).length;
          const omitidos = listaDeseos.length - n;
          return `${n} ${n === 1 ? 'producto agregado' : 'productos agregados'} al carrito${omitidos ? ` · ${omitidos} ${omitidos === 1 ? 'omitido' : 'omitidos'}` : ''}.`;
        }}
        onCompartir={() => copiar('https://www.wala.pe/wishlist/ISAAC7K')}
        onFechasEspeciales={() => avisar('En la tienda', 'Abriría tu registro de regalos (/regalar/ISAAC7K)', 'info')}
      />
    );
  } else if (ruta === '/cuenta/fechas-importantes') {
    pagina = (
      <PaginaFechas
        personas={vacio ? [] : personas}
        festivas={vacio ? [] : [{ nombre: 'Halloween', fecha: '0000-10-31', icono: 'destello', personas: [{ nombre: 'María', ideas: ideasDe(fotos, 2) }] }]}
        encuesta={{ monedas: 15, url: '/encuesta-suscripcion' }}
        ganadas={ganadas}
        conjuntos={CONJUNTOS}
        cargando={cargando}
        onGuardar={async (p) => {
          await espera(700);
          setPersonas((l) => (p.id ? l.map((x) => (x.id === p.id ? { ...x, ...p } : x)) : [...l, { ...p, id: `per${Date.now().toString(36)}`, ideas: ideasDe(fotos, 0), ideasGenerales: true }]));
          if (!p.id) { setGanadas(5); onMonedas?.(5); volarMonedasGanadas(null, 5); }
        }}
        onEliminar={(id) => { setPersonas((l) => l.filter((x) => x.id !== id)); avisar('Persona quitada', undefined, 'info'); }}
        onSubirFoto={async (archivo) => { await espera(700); return URL.createObjectURL(archivo); }}
        onAgregarIdea={(i) => avisar('Agregado al carrito', i.nombre)}
        onAgregarPaquete={(id) => { setPersonas((l) => l.map((x) => (x.id === id ? { ...x, paquete: { ...x.paquete, agregado: true } } : x))); avisar('Paquete agregado al carrito'); }}
        onAgregarIdeas={(id) => { setPersonas((l) => l.map((x) => (x.id === id ? { ...x, ideas: x.ideas.map((i) => ({ ...i, agregada: true })) } : x))); avisar('Ideas agregadas al carrito'); }}
      />
    );
  } else if (ruta === '/cuenta/ajustes') {
    pagina = (
      <PaginaAjustes
        tema={tema === 'dark' ? 'noche' : 'claro'}
        onTema={onTema}
        idioma={idioma}
        onIdioma={(i) => { setIdioma(i); if (i !== 'es') avisar('Idioma', 'En la tienda, Walá se vería en ese idioma', 'info'); }}
        onCerrarSesion={onCerrarSesion}
      />
    );
  } else {
    pagina = <PaginaResumenCuenta usuario={usuarioMarco} monedas={monedas} enEspera={50} grupos={GRUPOS_CUENTA_COMPLETO} />;
  }

  return (
    <Parte n="C0" nombre="MarcoCuenta">
      <MarcoCuenta
        usuario={usuarioMarco}
        grupos={GRUPOS_CUENTA_COMPLETO}
        activo={enDetalle ? '/cuenta/pedidos' : modulo.ruta}
        volver={enDetalle ? null : undefined}
        onCerrarSesion={onCerrarSesion}
        perfilIncompleto={incompleto}
      >
        <Parte n={modulo.n} nombre={modulo.componente} rejilla>{pagina}</Parte>
      </MarcoCuenta>
    </Parte>
  );
}

/* ── Encuesta (/encuesta-suscripcion) ─────────────────────── */

/** Estados para probar la encuesta en la Tienda de prueba. */
export const ESTADOS_ENCUESTA = [
  ['completada', 'Ya respondida'],
  ['conDatos', 'Con personas guardadas'],
  ['cargando', 'Cargando'],
  ['falla', 'Falla al guardar'],
];

/** Las preguntas de "Un poco sobre ti" por defecto (basicDataPanel). */
const SOBRE_TI = [
  { id: 'nombres', etiqueta: '¿Cómo te llamas?', tipo: 'texto', requerido: true },
  { id: 'familia', etiqueta: '¿Tienes familia?', tipo: 'opciones', opciones: ['Vivo solo/a', 'Vivo en pareja', 'Tengo hijos', 'Vivo con mis padres/familiares'] },
  { id: 'frecuencia_ropa', etiqueta: '¿Con qué frecuencia sueles comprar ropa?', tipo: 'opciones', opciones: ['Cada semana', 'Al menos una vez al mes', 'Solo en ocasiones especiales o cambios de temporada', 'Casi nunca'] },
  { id: 'preferencia_compra', etiqueta: '¿Dónde prefieres comprar?', tipo: 'opciones', opciones: ['Prefiero ir a la tienda física', 'Prefiero comprar 100% online', 'Me gustan ambas opciones'] },
];

/**
 * La encuesta con datos de prueba: guarda en memoria, paga 15 + 5 por fecha
 * (tope 50) y devuelve ideas con las fotos de la demo.
 */
export function EncuestaDemo({ sesion, usuario, estados = [], fotos = [], onMonedas, toast, onIrA }) {
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });
  const conDatos = estados.includes('conDatos');
  return (
    <PaginaEncuesta
      key={estados.join('-')}
      config={{ sobreTi: { campos: SOBRE_TI } }}
      conjuntos={CONJUNTOS}
      sesion={sesion}
      completada={estados.includes('completada')}
      cargando={estados.includes('cargando')}
      inicial={conDatos ? { respuestas: { nombres: usuario?.nombre || 'Isaac' }, grupos: ['pareja', 'hermanos'], personas: personasDemo(fotos) } : { respuestas: { nombres: usuario?.nombre || '' } }}
      onOmitir={() => onIrA?.('/')}
      onTerminar={async ({ personas }) => {
        await espera(900);
        if (estados.includes('falla')) throw new Error('falla');
        const fechas = personas.reduce((n, p) => n + p.eventos.filter((e) => e.fecha).length, 0);
        const monedas = 15 + Math.min(50, fechas * 5);
        onMonedas?.(monedas);
        volarMonedasGanadas(null, monedas);
        return { monedas, ideas: personas.slice(0, 3).map((p, k) => ({ id: p.id, nombre: p.nombre, ideas: ideasDe(fotos, k) })) };
      }}
      onSubirFoto={async (archivo) => { await espera(700); return URL.createObjectURL(archivo); }}
      onAgregarIdea={(i) => avisar('Agregado al carrito', i.nombre)}
      urlTienda="/tienda"
    />
  );
}

/* ── Acceso (/login, /registro, /recuperar-contrasena, /completar-perfil) ── */

/** Las pantallas de acceso de la Tienda de prueba. */
export const VISTAS_ACCESO = [
  { ruta: '/login', texto: 'Iniciar sesión', n: 'A1', componente: 'PaginaLogin' },
  { ruta: '/registro', texto: 'Crear cuenta', n: 'A2', componente: 'PaginaRegistro' },
  { ruta: '/recuperar-contrasena', texto: 'Recuperar contraseña', n: 'A3', componente: 'PaginaRecuperar' },
  { ruta: '/completar-perfil', texto: 'Completar perfil', n: 'A4', componente: 'PaginaCompletarPerfil' },
];

const PAISES_ACCESO = [
  { valor: 'PE', texto: 'Perú', prefijo: '+51' }, { valor: 'AR', texto: 'Argentina', prefijo: '+54' }, { valor: 'CL', texto: 'Chile', prefijo: '+56' },
  { valor: 'CO', texto: 'Colombia', prefijo: '+57' }, { valor: 'MX', texto: 'México', prefijo: '+52' }, { valor: 'US', texto: 'Estados Unidos', prefijo: '+1' },
  { valor: 'ES', texto: 'España', prefijo: '+34' },
];

/**
 * Login, registro, recuperar y completar perfil con datos de prueba. Para
 * ver los errores: contraseña "error" al entrar, un correo con "usado" al
 * registrarse y el DNI 12345678 (ya registrado).
 */
export function AccesoDemo({ ruta = '/login', toast, onIrA, onEntrar }) {
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2400 });
  const vista = VISTAS_ACCESO.find((v) => v.ruta === ruta) || VISTAS_ACCESO[0];
  const yaRegistrado = (d) => {
    if (String(d.documento) === '12345678') throw new Error('Este documento ya está registrado en otra cuenta. Si es tuyo, inicia sesión con esa cuenta o recupera tu contraseña.');
  };
  let pagina;
  if (vista.ruta === '/registro') {
    pagina = (
      <PaginaRegistro
        paises={PAISES_ACCESO}
        datosIniciales={{ pais: 'PE' }}
        correo="isaac@correo.com"
        onCrearCuenta={async ({ correo }) => {
          await espera(800);
          if (correo.includes('usado')) throw new Error('Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.');
        }}
        onGoogle={async () => { await espera(700); onIrA?.('/completar-perfil'); }}
        onRegistrar={async (d) => { await espera(900); yaRegistrado(d); avisar('¡Cuenta creada!', 'Sigue la encuesta para ganar monedas'); onEntrar?.(); onIrA?.('/encuesta-suscripcion'); }}
      />
    );
  } else if (vista.ruta === '/recuperar-contrasena') {
    pagina = <PaginaRecuperar onEnviar={() => espera(800)} />;
  } else if (vista.ruta === '/completar-perfil') {
    pagina = (
      <PaginaCompletarPerfil
        paises={PAISES_ACCESO}
        correo="isaac.castro@gmail.com"
        inicial={{ nombre: 'Isaac Castro', pais: 'PE', tipoDocumento: 'DNI', cumpleanos: '2001-07-12' }}
        deGoogle={{ nombre: true, cumpleanos: true }}
        onGuardar={async (d) => { await espera(900); yaRegistrado(d); avisar('¡Listo!', 'Ya puedes hacer pedidos'); onEntrar?.(); onIrA?.('/encuesta-suscripcion'); }}
      />
    );
  } else {
    pagina = (
      <PaginaLogin
        onEntrar={async ({ contrasena }) => {
          await espera(800);
          if (contrasena === 'error') throw new Error('Correo o contraseña incorrectos. Revisa e inténtalo de nuevo.');
          avisar('¡Hola de nuevo!', 'En la tienda iría a tu página de origen'); onEntrar?.(); onIrA?.('/');
        }}
        onGoogle={async () => { await espera(700); avisar('¡Hola de nuevo!', 'Entraste con Google'); onEntrar?.(); onIrA?.('/'); }}
      />
    );
  }
  return <div key={vista.ruta}>{pagina}</div>;
}

/* ── Crear (/personalizar) ─────────────────────────────────── */

/** Estados para probar Crear en la Tienda de prueba. */
export const ESTADOS_CREAR = [
  ['cargando', 'Cargando prendas'],
  ['sinPrendas', 'Sin prendas'],
  ['sinCombos', 'Sin combos'],
];

/**
 * Crear con los datos reales de Walá (demo/crear.json): sus prendas base,
 * sus combos (pareja y conjunto) y los diseños de la comunidad; con sesión,
 * esos mismos diseños hacen de borradores y creaciones del cliente.
 */
export function CrearDemo({ sesion, esAdmin, estados = [], toast, onIrA }) {
  const [para, setPara] = useState(1);
  // Lo del cliente se puede eliminar, renombrar y (el admin) publicar, como en Mis creaciones.
  const [mias, setMias] = useState(() => creacionesDemo());
  const [suyos, setSuyos] = useState(BORRADORES);
  const [publicadas, setPublicadas] = useState(() => new Set(mias.filter((c) => c.publicada).map((c) => c.id)));
  const avisar = (titulo, tipo = 'exito') => toast?.({ tipo, titulo, duracion: 2000 });
  // "Llevar en combo": los combos publicados de su prenda (una creación suelta).
  const combosDe = (c) => (c.imagenes ? [] : CREAR.combos
    .filter((k) => k.publicado && k.piezas.some((pz) => pz.prendaId === c.prendaId))
    .map((k) => ({ id: k.id, nombre: k.name, piezas: k.piezas.length, precio: precioDe(k.id), onLlevar: async () => { await espera(700); onIrA?.(`/combo/${k.id}?nuevo=1`); } })));
  const conAcciones = (c) => ({
    ...c,
    combos: combosDe(c),
    publicada: publicadas.has(c.id),
    onEliminar: async () => { await espera(500); setMias((l) => l.filter((x) => x.id !== c.id)); avisar('Creación eliminada', 'info'); },
    onRenombrar: async (nombre) => { await espera(300); setMias((l) => l.map((x) => (x.id === c.id ? { ...x, nombre } : x))); },
    comunidad: esAdmin ? {
      estado: publicadas.has(c.id) ? 'publicada' : null,
      onPublicar: async () => { await espera(500); setPublicadas((s) => new Set([...s, c.id])); avisar('Publicada en la comunidad'); },
      onActualizar: async () => { await espera(500); avisar('Publicación actualizada'); },
      onRetirar: async () => { await espera(500); setPublicadas((s) => { const n = new Set(s); n.delete(c.id); return n; }); avisar('Retirada de la comunidad', 'info'); },
    } : undefined,
  });
  // Lo mismo que la tienda: el admin ve también los borradores.
  const prendas = PRENDAS_CREAR.filter((p) => esAdmin || p.visible !== false).map(prendaCrearDesdeProducto);
  const combos = estados.includes('sinCombos') ? [] : CREAR.combos
    .filter((c) => esAdmin || c.publicado)
    .map((c) => comboCrearDesde(c, PRENDA_POR_ID))
    .filter(Boolean);
  const comunidad = CREAR.comunidad.map(disenoComunidadDesde);
  return (
    <PaginaCrear
      prendas={estados.includes('sinPrendas') ? [] : prendas}
      combos={combos}
      cargando={estados.includes('cargando')}
      para={para}
      onPara={setPara}
      borradores={sesion ? suyos.map((b) => ({ ...b, combos: combosDe(b), onEliminar: async () => { await espera(400); setSuyos((l) => l.filter((x) => x.id !== b.id)); avisar('Borrador eliminado', 'info'); } })) : []}
      creaciones={sesion ? mias.map(conAcciones) : []}
      totalCreaciones={sesion ? mias.length : 0}
      comunidad={comunidad}
      totalComunidad={comunidad.length}
    />
  );
}

/* ── Comunidad (/comunidad) ────────────────────────────────── */

/** Estados para probar la galería en la Tienda de prueba. */
export const ESTADOS_COMUNIDAD = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['vacia', 'Sin diseños'],
];

/** La galería con los diseños reales de la comunidad (demo/crear.json). */
export function ComunidadDemo({ estados = [], toast }) {
  return (
    <PaginaComunidad
      disenos={estados.includes('vacia') ? [] : CREAR.comunidad.map(disenoComunidadDesde)}
      cargando={estados.includes('cargando')}
      error={estados.includes('error')}
      onReintentar={() => toast?.({ tipo: 'info', titulo: 'Volviendo a cargar', duracion: 1800 })}
    />
  );
}

/* ── Una creación (/creacion/:id) ──────────────────────────── */

/** Estados para probar la ficha de una creación. */
export const ESTADOS_CREACION = [
  ['cargando', 'Cargando'],
  ['noEncontrada', 'No encontrada'],
  ['noDisponible', 'Prenda no disponible'],
  ['vieja', 'Guardada con versión vieja'],
];

/**
 * La ficha de una creación con un diseño real (de la comunidad) como si fuera
 * del cliente. `id`: el del diseño (por defecto, el primero que no es combo).
 */
export function CreacionDemo({ id, sesion, esAdmin, estados = [], toast, onIrA, onMonedas }) {
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });
  const sueltos = CREAR.comunidad.filter((d) => d.tipo !== 'combo');
  const d = CREAR.comunidad.find((x) => x.id === id && x.tipo !== 'combo') || sueltos[0];
  const prenda = d && PRENDA_POR_ID.get(d.productId);
  const base = fichaCreacionDesde({ ...d, name: d?.nombre }, estados.includes('noDisponible') ? { ...prenda, deleted: true } : prenda, { fecha: Date.now() - 3 * 864e5, esAdmin });
  const [talla, setTalla] = useState(base.talla || '');
  const [nombre, setNombre] = useState(base.creacion.nombre);
  const combosDeLaPrenda = CREAR.combos.filter((c) => c.publicado && c.piezas.some((p) => p.prendaId === d?.productId));
  let estado;
  if (!sesion) estado = 'sinSesion';
  else if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('noEncontrada')) estado = 'noEncontrada';
  return (
    <PaginaCreacion
      {...base}
      creacion={{ ...base.creacion, nombre }}
      estado={estado}
      lista={!estados.includes('vieja')}
      talla={talla}
      onTalla={setTalla}
      combosSugeridos={combosDeLaPrenda.map((c) => ({ id: c.id, nombre: c.name, piezas: c.piezas.length, precio: precioDe(c.id), onUsar: async () => { await espera(700); onIrA?.(`/combo/${c.id}`); } }))}
      onAgregar={async ({ talla: t, cantidad }) => { await espera(500); avisar('¡Agregado al carrito!', `${nombre} · Talla ${t} × ${cantidad}`); }}
      onComprar={async () => { await espera(500); onIrA?.('/checkout'); }}
      onRenombrar={async (n) => { await espera(400); setNombre(n); }}
      onEliminar={async () => { await espera(600); avisar('Creación eliminada', undefined, 'info'); onIrA?.('/cuenta/creaciones'); }}
      comunidad={esAdmin ? { estado: null, onPublicar: async () => { await espera(600); avisar('Publicada en la comunidad'); }, onRetirar: async () => { await espera(600); } } : undefined}
    />
  );
}

/* ── Ver diseño (/ver/:id) ─────────────────────────────────── */

export const ESTADOS_VER = [
  ['cargando', 'Cargando'],
  ['noDisponible', 'No disponible'],
];

/**
 * Ver diseño con un combo real (sus dos prendas, frente y espalda) y, en la
 * segunda, la espalda lisa para ver cómo se dice.
 */
export function VerDisenoDemo({ estados = [] }) {
  const d = CREAR.comunidad.find((x) => x.tipo === 'combo') || CREAR.comunidad[0];
  const tallas = ['M', 'S'];
  const piezas = (d?.piezas || []).map((p, i) => ({
    prenda: p.productName,
    nombre: p.nombre,
    color: p.color?.nombre,
    colorHex: p.color?.hex,
    talla: tallas[i % tallas.length],
    // La segunda prenda con la espalda lisa (sin diseño), para ver cómo se dice.
    lados: [...(p.vistasPrevias || []).map((v) => ({ nombre: v.nombre, url: v.url })), ...(i === 1 && (p.vistasPrevias || []).length < 2 ? [{ nombre: 'Espalda', url: '' }] : [])],
  }));
  return <PaginaVerDiseno titulo={d?.nombre} piezas={piezas} cargando={estados.includes('cargando')} noDisponible={estados.includes('noDisponible')} />;
}

/* ── Un combo (/combo/:id) ─────────────────────────────────── */

export const ESTADOS_COMBO = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['noDisponible', 'No disponible'],
];

/** Los diseños reales sueltos (y cada prenda de los combos), para "Mis creaciones". */
const DISENOS_SUELTOS = CREAR.comunidad.flatMap((d) => (d.tipo === 'combo'
  ? (d.piezas || []).map((p, k) => ({ ...p, id: `${d.id}-${k}`, nombre: p.nombre }))
  : [d]));
const disenoPorId = (id) => DISENOS_SUELTOS.find((x) => x.id === id);

/**
 * Un combo con los datos reales: ?nuevo=1 empieza vacío, ?mio=<id> abre un
 * combo guardado (un diseño real de pareja) y ?plantilla=<id> parte de uno de
 * la comunidad. Se arma de verdad: copiar de otra prenda, usar en las demás,
 * quitar, tomar de Mis creaciones y elegir tallas.
 */
export function ComboDemo({ ruta = '/combo/', sesion, esAdmin, estados = [], toast, onIrA }) {
  const [camino, consulta = ''] = ruta.split('?');
  const q = new URLSearchParams(consulta);
  const combo = CREAR.combos.find((c) => c.id === camino.split('/')[2]) || CREAR.combos[0];
  const prendas = combo.piezas.map((p) => PRENDA_POR_ID.get(p.prendaId));
  const unaTalla = new Set(combo.piezas.map((p) => p.prendaId)).size > 1;
  const origen = CREAR.comunidad.find((d) => d.id === (q.get('mio') || q.get('plantilla')) && d.tipo === 'combo');
  const [armado, setArmado] = useState(() => prendas.map((_, i) => {
    const pieza = origen?.piezas?.[i];
    if (!pieza) return { designId: null };
    return { designId: `${origen.id}-${i}`, plantilla: Boolean(q.get('plantilla')) };
  }));
  const [nombres, setNombres] = useState({});
  const [nombreCombo, setNombreCombo] = useState(origen?.nombre);
  const [tallaConjunto, setTallaConjunto] = useState('');
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });
  const poner = (i, cambio) => setArmado((a) => a.map((x, k) => (k === i ? { ...x, ...cambio } : x)));
  const mio = Boolean(q.get('mio')) && origen;

  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('error')) estado = 'error';
  else if (estados.includes('noDisponible')) estado = 'noDisponible';

  const piezas = prendas.map((prenda, i) => {
    const cfg = leerPrendaBase(prenda);
    const a = armado[i];
    const d = a.designId && disenoPorId(a.designId);
    const lados = (d?.vistasPrevias || []).map((v) => v.nombre).filter(Boolean);
    const otra = armado.findIndex((x, k) => k !== i && x.designId && !x.plantilla);
    const vaciasIguales = armado.filter((x, k) => k !== i && !x.designId && combo.piezas[k].prendaId === combo.piezas[i].prendaId).length;
    const estadoPieza = !d ? 'vacia' : a.plantilla ? 'plantilla' : 'disenada';
    return {
      i,
      prenda: prenda.name,
      foto: d?.vistasPrevias?.[0]?.url || cfg.vistas[0]?.imagen,
      estado: estadoPieza,
      nombre: nombres[i] || d?.nombre,
      color: d?.color ? { nombre: d.color.nombre, fondo: d.color.hex } : undefined,
      lados,
      lista: Boolean(d),
      tallas: cfg.tallas,
      talla: a.talla,
      onTalla: (t) => poner(i, { talla: t }),
      urlDisenar: `/crear/${prenda.id}?combo=${combo.id}&pieza=${i}`,
      urlEditar: `/crear/${prenda.id}?combo=${combo.id}&pieza=${i}&designId=${a.designId}`,
      copiarDe: !d && otra >= 0 ? { numero: otra + 1, url: `/crear/${prenda.id}?combo=${combo.id}&pieza=${i}&copiar=${armado[otra].designId}` } : undefined,
      usarEnLasDemas: vaciasIguales === 1 ? 'la otra' : 'las demás',
      onUsarEnLasDemas: d && vaciasIguales > 0 ? () => setArmado((x) => x.map((y, k) => (!y.designId && combo.piezas[k].prendaId === combo.piezas[i].prendaId ? { designId: a.designId } : y))) : undefined,
      onQuitar: d ? () => poner(i, { designId: null, plantilla: false, talla: '' }) : undefined,
      onRenombrar: d ? async (nuevo) => { await espera(300); setNombres((x) => ({ ...x, [i]: nuevo })); } : undefined,
    };
  });
  const galeria = piezas.flatMap((p, k) => {
    const d = armado[k].designId && disenoPorId(armado[k].designId);
    const fotos = d ? (d.vistasPrevias || []) : leerPrendaBase(prendas[k]).vistas.map((v) => ({ url: v.imagen, nombre: v.nombre }));
    return fotos.filter((f) => f.url).map((f) => ({ url: f.url, nombre: `Prenda ${k + 1} · ${f.nombre}` }));
  });
  const sueltas = prendas.reduce((total, p) => total + precioDe(p.id), 0);

  return (
    <PaginaCombo
      estado={estado}
      combo={{ nombre: combo.name, descripcion: 'Cada prenda con su propio diseño, color y talla.', publicado: combo.publicado }}
      mio={mio ? { nombre: nombreCombo, estado: 'guardado', onRenombrar: async (n) => { await espera(300); setNombreCombo(n); } } : undefined}
      plantilla={q.get('plantilla') && origen && armado.some((a) => a.plantilla) ? { nombre: origen.nombre, urlPersonalizar: piezas[0].urlEditar } : undefined}
      piezas={piezas}
      galeria={galeria}
      precio={precioDe(combo.id)}
      sueltas={sueltas}
      unaTalla={unaTalla}
      tallas={unaTalla ? leerPrendaBase(prendas[0]).tallas : []}
      talla={tallaConjunto}
      onTalla={setTallaConjunto}
      misCreaciones={sesion ? (i) => DISENOS_SUELTOS.filter((x) => x.productId === prendas[i].id).map((x) => ({ id: x.id, nombre: x.nombre, imagen: x.vistasPrevias?.[0]?.url })) : undefined}
      onElegirCreacion={(i, id) => poner(i, { designId: id, plantilla: false })}
      onAgregar={async () => { await espera(700); avisar('¡Combo agregado al carrito!', nombreCombo || combo.name); onIrA?.('/carrito'); }}
      comunidad={mio && esAdmin ? { estado: null, onPublicar: async () => { await espera(500); avisar('Publicado en la comunidad'); } } : undefined}
      onReintentar={() => avisar('Volviendo a cargar', undefined, 'info')}
    />
  );
}


/* ── El estudio (/crear/:id) ───────────────────────────────── */

export const ESTADOS_ESTUDIO = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['noDisponible', 'Prenda no disponible'],
];

/* Las letras del estudio por cómo se ven (como SelectorFuente de la tienda). */
const FUENTES_ESTUDIO = [
  ['Simples', ['Montserrat', 'Rubik', 'Kanit']],
  ['Gruesas', ['Bebas Neue', 'Anton', 'Oswald', 'Righteous', 'Franklin Gothic Heavy Italic', 'DK Longreach']],
  ['Deportivas y retro', ['Varsity Team Bold', 'Keep on Truckin']],
  ['Elegantes', ['Playfair Display', 'Libre Baskerville']],
  ['Escritas a mano', ['Pacifico', 'Lobster', 'Dancing Script', 'Great Vibes', 'Permanent Marker', 'Caveat', 'Back to Black', 'Brush Script', 'Bernadette', 'Rainbow Kitty']],
].flatMap(([grupo, fuentes]) => fuentes.map((f) => ({ valor: f, texto: f, detalle: grupo })));

const GOOGLE_ESTUDIO = 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@700&family=Dancing+Script:wght@700&family=Great+Vibes&family=Kanit:wght@400;800&family=Libre+Baskerville:wght@400;700&family=Lobster&family=Oswald:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@400;900&family=Righteous&family=Rubik:wght@400;800&display=swap';

/** Las letras del estudio se cargan solo al abrirlo (como en la tienda). */
const useFuentesEstudio = () => useEffect(() => {
  [GOOGLE_ESTUDIO, '/fonts/fonts.css'].forEach((href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  });
}, []);

/* "Subir imagen": las caras de Kapi hacen de fotos del cliente (con los
   píxeles de una foto buena, una regular y una chica, para ver la calidad). */
const SUBIDAS = [
  { src: '/assets/kapi/3d/kapi-feliz.webp', px: 1800 },
  { src: '/assets/kapi/3d/kapi-hambre.webp', px: 1000 },
  { src: '/assets/kapi/3d/kapi-triste.webp', px: 500 },
];

/** Un diseño de ejemplo (Kapi en el pecho, una frase en la espalda) para editar o partir de él. */
const disenoDeEjemplo = (prenda, texto) => {
  const pecho = prenda.vistas[0]?.zonas[0];
  const espalda = prenda.vistas[1]?.zonas[0];
  return {
    ...(pecho && { [pecho.id]: [{ id: 'k1', tipo: 'imagen', src: '/assets/kapi/3d/kapi-feliz.webp', px: 1800, ancho: 0.62, x: 0.5, y: 0.48 }] }),
    ...(espalda && { [espalda.id]: [{ id: 't1', tipo: 'texto', texto, fuente: 'Bebas Neue', tamano: 0.24, x: 0.5, y: 0.3, color: '#ffffff', contorno: true, contornoColor: '#7c3aed', grosor: 0.08, sombra: false }] }),
  };
};

/**
 * El estudio con una prenda real (demo/crear.json). Se abre como en la
 * tienda: /crear/:id para empezar, ?designId= para editar una creación,
 * ?plantilla= desde un diseño de la comunidad, ?copiar= desde otra prenda y
 * ?combo=&pieza= para una prenda de un combo (vuelve al combo al terminar).
 */
export function EstudioDemo({ ruta = '/crear/', sesion, estados = [], toast, onIrA }) {
  useFuentesEstudio();
  const [camino, consulta = ''] = ruta.split('?');
  const q = new URLSearchParams(consulta);
  const producto = PRENDA_POR_ID.get(camino.split('/')[2]) || PRENDAS_CREAR.find((p) => p.name === 'Polera clásica') || PRENDAS_CREAR[0];
  const prenda = useMemo(() => prendaEstudioDesde(producto), [producto]);
  const [subidas, setSubidas] = useState(0);
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });

  const combo = q.get('combo') && CREAR.combos.find((c) => c.id === q.get('combo'));
  const origen = CREAR.comunidad.find((d) => d.id === (q.get('designId') || q.get('plantilla')) || (d.piezas || []).some((_, k) => `${d.id}-${k}` === q.get('designId')));
  const modo = q.get('designId') ? 'editar' : q.get('plantilla') ? 'plantilla' : 'nuevo';
  const conDiseno = modo !== 'nuevo' || q.get('copiar');
  const negro = prenda.colores.find((c) => c.nombre === 'Negro');
  const inicial = conDiseno ? {
    color: negro?.id,
    capas: disenoDeEjemplo(prenda, 'WALÁ CREW'),
    nombre: modo === 'editar' ? (origen?.nombre || 'Mi polera de Kapi') : '',
  } : {};

  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('error')) estado = 'error';
  else if (estados.includes('noDisponible')) estado = 'noDisponible';

  return (
    <PaginaEstudio
      key={ruta}
      estado={estado}
      prenda={prenda}
      inicial={inicial}
      modo={modo}
      plantilla={origen?.nombre}
      combo={combo ? { nombre: combo.name, numero: Number(q.get('pieza') || 0) + 1, total: combo.piezas.length } : undefined}
      sesion={sesion}
      fuentes={FUENTES_ESTUDIO}
      urlVolver={combo ? `/combo/${combo.id}?nuevo=1` : '/personalizar'}
      onSubirImagen={async () => {
        await espera(700);
        setSubidas((n) => n + 1);
        return SUBIDAS[subidas % SUBIDAS.length];
      }}
      onQuitarFondo={async (capa) => { await espera(1600); avisar('Fondo quitado'); return capa.src; }}
      onGuardar={async () => { await espera(700); }}
      onAgregar={async ({ talla, cantidad }) => { await espera(600); avisar('¡Agregado al carrito!', `${prenda.nombre}${talla ? ` · Talla ${talla}` : ''} × ${cantidad}`); }}
      onDescargar={() => avisar('Se descargaría tu diseño', 'Una imagen de cada lado, con el logo de Walá en una esquina.', 'info')}
      onUsarEnCombo={async () => { avisar('Prenda lista', `Vuelves a «${combo.name}» con tu diseño.`); onIrA?.(`/combo/${combo.id}?nuevo=1`); }}
      onReintentar={() => avisar('Volviendo a cargar', undefined, 'info')}
    />
  );
}

/* ── El editor de un producto del catálogo (/editor/:id) ── */

/*
 * La Polera básica real (productos_wala, hoy retirada: en wala.pe ningún
 * producto visible abre este editor) en el MISMO estudio de Crear, con
 * prendaEditorDesde. El precio sube S/ 5 por texto y S/ 10 por imagen, como
 * calculatePrice de la tienda. El "diseño sin terminar" es de ejemplo.
 */
export const ESTADOS_EDITOR = [
  ['pendiente', 'Diseño sin terminar'],
  ['noPersonalizable', 'No se personaliza'],
  ['retirado', 'Producto retirado'],
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
];

export function EditorDemo({ sesion, estados = [], toast, onIrA }) {
  useFuentesEstudio();
  const prenda = useMemo(() => prendaEditorDesde(EDITOR.producto, { medidas: EDITOR.medidas }), []);
  const [subidas, setSubidas] = useState(0);
  const [inicial, setInicial] = useState({});
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });
  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('error')) estado = 'error';
  return (
    <PaginaEditor
      key={`${estados.join()}-${inicial.nombre || ''}`}
      estado={estado}
      prenda={estados.includes('retirado') ? null : prenda}
      personalizable={!estados.includes('noPersonalizable')}
      pendiente={estados.includes('pendiente') && !inicial.nombre ? { nombre: 'Diseño 12/10/2026', fecha: '12 de octubre' } : undefined}
      onContinuar={() => setInicial({ nombre: 'Diseño 12/10/2026', capas: disenoDeEjemplo(prenda, 'MAMÁ 2026'), color: prenda.colores.find((c) => c.nombre === 'Rosado')?.id })}
      inicial={inicial}
      modo={inicial.nombre ? 'editar' : 'nuevo'}
      sesion={sesion}
      fuentes={FUENTES_ESTUDIO}
      urlProducto={`/producto/${EDITOR.producto.id}`}
      onSubirImagen={async () => {
        await espera(700);
        setSubidas((n) => n + 1);
        return SUBIDAS[subidas % SUBIDAS.length];
      }}
      onQuitarFondo={async (capa) => { await espera(1600); avisar('Fondo quitado'); return capa.src; }}
      onGuardar={async () => { await espera(700); }}
      onAgregar={async ({ talla, cantidad }) => { await espera(600); avisar('¡Agregado al carrito!', `${prenda.nombre}${talla ? ` · Talla ${talla}` : ''} × ${cantidad}`); onIrA?.('/carrito'); }}
      onDescargar={() => avisar('Se descargaría tu diseño', 'Una imagen de cada lado, con el logo de Walá en una esquina.', 'info')}
      onReintentar={() => avisar('Volviendo a cargar', undefined, 'info')}
    />
  );
}

