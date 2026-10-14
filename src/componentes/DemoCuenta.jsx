import React, { useCallback, useMemo, useState } from 'react';
import { User, Package, MapPin, Settings, Gift, Ticket, Trophy, Users, Sparkles, Heart, Calendar } from 'lucide-react';
import {
  MarcoCuenta, PaginaCuentaInvitado, PaginaResumenCuenta, PaginaPerfil, PaginaDirecciones, PaginaAjustes, PaginaPedidos,
  PaginaCatalogo, PaginaCupones, PaginaMisiones, PaginaReferidos, PaginaCreaciones, PaginaListaDeseos, PaginaFechas,
} from './kit';
import POLERA from './demo/polera-fondo-blanco.jpg';
import POLERA_ESPALDA from './demo/polera-fondo-blanco-espalda.jpg';
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

const LUGARES = {
  departamentos: DEPARTAMENTOS,
  provincias: getProvincias,
  distritos: (d) => distritosSugeridos({ country: d.pais, city: d.ciudad, department: d.departamento, province: d.provincia }),
  legible: (d) => lugarLegible({ country: d.pais, city: d.ciudad, district: d.distrito, department: d.departamento, province: d.provincia }),
};

const DIRECCIONES = [
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
const creacionesDemo = (fotos) => [
  { id: 'd1', nombre: 'Mi polera con Kapi', imagen: POLERA, imagenEspalda: POLERA_ESPALDA, producto: 'Polera clásica', color: { nombre: 'Blanco', hex: '#ffffff' },
    fecha: 'Guardada hace 3 días', precio: 59.9, comprado: true, publicada: true, urlEditar: '/crear/polera?designId=d1', urlComprar: '/creacion/d1' },
  { id: 'd2', nombre: 'Para el equipo', imagen: POLERA, imagenEspalda: POLERA_ESPALDA, producto: 'Polera clásica', color: { nombre: 'Blanco', hex: '#ffffff' },
    fecha: 'Guardada ayer', precio: 54.9, precioAntes: 64.9, combo: 'Pareja', urlEditar: '/crear/polera?designId=d2', urlComprar: '/creacion/d2' },
  { id: 'd3', nombre: 'Regalo para papá', imagen: fotos[2]?.imagen, producto: fotos[2]?.nombre, fecha: 'Guardada hace 12 días', precio: 34.9,
    lados: 'Frente', urlEditar: '/editor/taza?designId=d3', urlComprar: '/creacion/d3' },
  { id: 'd4', nombre: 'Diseño de verano', imagen: fotos[0]?.imagen, producto: 'Polo descontinuado', fecha: 'Guardada hace 40 días', disponible: false, urlEditar: '/editor/x?designId=d4' },
];
const BORRADORES = [
  { id: 'b1', nombre: 'Sin terminar', imagen: POLERA, producto: 'Polera clásica', fecha: 'Guardada hoy', urlEditar: '/crear/polera?borrador=b1' },
  { id: 'b2', nombre: 'Idea para Carlos', imagen: POLERA_ESPALDA, producto: 'Polera clásica', fecha: 'Guardada ayer', urlEditar: '/crear/polera?borrador=b2' },
];

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

export function CuentaDemo({ ruta = '/cuenta', sesion, usuario, monedas, onMonedas, tema, onTema, onCerrarSesion, estados = [], toast, Parte, pedidos, fotos = [], deseos = [], onAgregar, onIrATienda }) {
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
  const [creaciones, setCreaciones] = useState(() => creacionesDemo(fotos));
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

  const modulo = MODULOS_CUENTA.find((m) => m.ruta === ruta) || MODULOS_CUENTA[0];
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
  } else if (ruta === '/cuenta/pedidos') {
    pagina = <PaginaPedidos pedidos={pedidos} onIrATienda={onIrATienda} />;
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
        activo={modulo.ruta}
        onCerrarSesion={onCerrarSesion}
        perfilIncompleto={incompleto}
      >
        <Parte n={modulo.n} nombre={modulo.componente} rejilla>{pagina}</Parte>
      </MarcoCuenta>
    </Parte>
  );
}
