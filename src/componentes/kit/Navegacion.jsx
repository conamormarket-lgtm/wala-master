import React, { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, User, Heart, Bell, BellRing, ChevronDown } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import Boton from './Boton';
import { Buscador } from './Formulario';
import { RESORTE } from './Efectos';
import { ListaNotificaciones, HojaInferior } from './Feedback';
import { Enlace } from './Enlace';
import Desplegable from './Desplegable';
import { BotonTema } from './piezas/Marco';
import { Avatar } from './piezas/Avatar';
import { PanelBusqueda, useBusquedasRecientes } from './piezas/PanelBusqueda';
import { Texto, useTexto } from './Traduccion';
import { Cargando } from './Cargando';
import s from './Navegacion.module.css';

/*
 * El contenido de los menús llega cuando hace falta: la cabecera está en todas
 * las páginas y sus menús solo se ven al abrirlos. Se piden en cuanto el
 * puntero o el foco llegan a la cabecera (precargarMenus), así al abrir uno ya
 * suelen estar.
 */
const cargarMenus = () => import('./MenusCabecera');
const precargarMenus = () => { cargarMenus().catch(() => {}); };
const perezoso = (nombre) => lazy(() => cargarMenus().then((m) => ({ default: m[nombre] })));
const MenuTienda = perezoso('MenuTienda');
const MenuMarcas = perezoso('MenuMarcas');
const AyudaMonedas = perezoso('AyudaMonedas');
const MenuCuenta = perezoso('MenuCuenta');
const VistaFavoritos = perezoso('VistaFavoritos');
const VistaCarrito = perezoso('VistaCarrito');

/** Un menú mientras llega su contenido (casi nunca se ve: se precarga). */
function ConMenu({ children }) {
  return <Suspense fallback={<div className={s.menuLlegando}><Cargando tamano="sm" /></div>}>{children}</Suspense>;
}

/**
 * Logo de marca: las mismas dos máscaras que el Header (forma con el violeta
 * de marca + la W calada en blanco). Al pasar el ratón un destello lo cruza.
 */
export function Logo({ alto = 32 }) {
  return (
    <span className={s.logoMarca} style={{ height: alto }} role="img" aria-label="Walá">
      <span className={s.logoForma} aria-hidden="true" />
      <span className={s.logoHuecos} aria-hidden="true" />
      <span className={s.logoDestello} aria-hidden="true" />
    </span>
  );
}

/**
 * Cabecera de la tienda: logo, enlaces (con menú grande en "Tienda"),
 * buscador y accesos. Cada acceso tiene su menú, como el header real:
 * monedas (ayuda), notificaciones, favoritos, carrito y cuenta.
 *
 * Con ratón los menús se abren al pasar por encima; en celular / app,
 * cuenta y tienda abren una hoja inferior, monedas un globo, y favoritos y
 * carrito navegan directo. Solo hay un menú abierto a la vez.
 *
 * Todo llega por props (en la app: AuthContext, CartContext, Firestore…):
 *  - enlaces: [{ id, texto, url, menu?: 'tienda' | 'marcas' | 'lista', props?, traducir? }]
 *    · menu 'lista': un menú de enlaces (MenuTienda con `props.categorias`
 *      como enlaces y su `titulo`); `props` sirve también para dar a cada
 *      menú sus propios datos.
 *    · los textos pasan por la traducción salvo `traducir: false` (la tienda
 *      ya los tradujo con su diccionario)
 *  - activo: id del enlace de la página
 *  - onAbrirMenu(id): se abrió el menú de un enlace (p. ej. para pedir las
 *    categorías solo entonces)
 *  - menuTienda: props de <MenuTienda>  · menuMarcas: props de <MenuMarcas>
 *  - tema: 'claro' | 'noche' + onTema → botón de tema (no en el celular)
 *  - monedas (null = aún no se sabe: "–"), monedasCargando (la píldora vacía)
 *  - notificaciones: [{ id, titulo, texto, fecha, leida, tipo, imagen, url }]
 *    + onLeer(id, notificacion) (con `url` el menú se cierra), onMarcarLeidas,
 *    onVerTodas (sin ella no hay botón), limiteNotificaciones (5),
 *    vacioNotificaciones: { titulo, texto },
 *    avisoPush: { onActivar, activando } → invitar a activar los avisos
 *  - usuario, gruposCuenta, promoCuenta, onCerrarSesion, textosCuenta,
 *    idiomas (ver MenuCuenta), cuenta: false = sin el botón de cuenta (la app)
 *  - estadoLogin: el state del router para volver después de entrar
 *  - favoritos: [{ id, nombre, imagen }], urlFavoritos, textosFavoritos
 *  - carrito: [{ id, nombre, imagen, precio, cantidad, variante, url }],
 *    urlPagar (null = "Ir a pagar" al carrito), metaEnvio (barra del envío gratis)
 *  - onBuscar(termino): ir a los resultados
 *  - buscarSugerencias(texto) → promesa de sugerencias (PanelBusqueda): con
 *    ella, el buscador abre el panel (recientes y sugerencias) debajo del
 *    campo; en el celular, una hoja con su propio campo. Sin ella, solo Enter.
 *  - ideasBusqueda: términos para "Lo más buscado" en el panel
 *  - celular: true / false fuerza la versión de celular (la tienda la decide
 *    con el mismo corte que la barra inferior); sin pasarla, se mide.
 *
 * Tres formas según su ancho (se mide la caja, así en la vista de celular del
 * editor también se ve como en un celular):
 *  - ancha (más de 1100 px): una fila, el buscador entre enlaces y accesos.
 *  - mediana (761 a 1100, tablet): dos filas; arriba el logo y los accesos,
 *    abajo los enlaces y el buscador. Nada se queda fuera de la pantalla.
 *  - celular (hasta 760): dos filas, logo y accesos arriba y el buscador
 *    abajo; sin enlaces ni cuenta (están en la barra inferior).
 * Monedas y notificaciones solo aparecen con sesión.
 */
export function Cabecera({
  enlaces = ENLACES_POR_DEFECTO,
  activo = 'tienda',
  onAbrirMenu,
  menuTienda = {},
  menuMarcas = {},
  tema,
  onTema,
  monedas = 0,
  monedasCargando = false,
  notificaciones = [],
  onLeer,
  onMarcarLeidas,
  onVerTodas,
  limiteNotificaciones = 5,
  vacioNotificaciones,
  avisoPush,
  usuario = null,
  gruposCuenta = [],
  promoCuenta,
  onCerrarSesion,
  textosCuenta,
  idiomas,
  cuenta = true,
  estadoLogin,
  favoritos = [],
  urlFavoritos = '/cuenta/wishlist',
  textosFavoritos,
  carrito = [],
  urlPagar = '/checkout',
  metaEnvio,
  onBuscar,
  buscarSugerencias,
  ideasBusqueda = [],
  placeholder = 'Buscar productos y marcas',
  celular,
}) {
  const uid = useId();
  const marcoRef = useRef(null);
  const cajaRef = useRef(null);
  const forma = useFormaCabecera(marcoRef, celular);
  const busqueda = useBuscadorConPanel({ buscarSugerencias, onBuscar, cajaRef, ideas: ideasBusqueda, enCelular: forma === 'celular' });
  const [sobre, setSobre] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  const t = {
    inicio: useTexto('Walá, inicio'),
    principal: useTexto('Principal'),
    sugerencias: useTexto('Sugerencias de búsqueda'),
    buscar: useTexto('Buscar'),
    placeholder: useTexto(placeholder),
    notificaciones: useTexto('Notificaciones'),
    campana: useTexto(`Notificaciones (${noLeidas} sin leer)`),
    favoritos: useTexto(`Favoritos (${favoritos.length})`),
    carrito: useTexto(`Carrito (${enCarrito})`),
    cuenta: useTexto('Mi cuenta'),
  };

  // Un solo menú abierto a la vez. `alAbrir` avisa cuando se abre (el menú de un enlace).
  const control = (clave, alAbrir) => ({
    abierto: abierto === clave,
    onAbiertoChange: (v) => {
      setAbierto((prev) => (v ? clave : prev === clave ? null : prev));
      if (v) alAbrir?.();
    },
  });

  const pildoras = (id) => (
    <>
      {sobre === id && <motion.span layoutId={`${uid}-sobre`} className={s.pildoraSobre} transition={RESORTE} />}
      {activo === id && <motion.span layoutId={`${uid}-activo`} className={s.subrayado} transition={RESORTE} />}
    </>
  );
  const textoDe = (e) => (e.traducir === false ? e.texto : <Texto>{e.texto}</Texto>);

  return (
    <div className={s.cabeceraCaja} ref={marcoRef}>
    <header
      className={[s.cabecera, forma === 'celular' && s.celular, forma === 'mediana' && s.mediana].filter(Boolean).join(' ')}
      onPointerEnter={precargarMenus}
      onFocusCapture={precargarMenus}
      onTouchStart={precargarMenus}
    >
      <Enlace to="/" className={s.logo} aria-label={t.inicio}>
        <Logo alto={36} />
      </Enlace>

      <nav className={s.enlaces} aria-label={t.principal} onMouseLeave={() => setSobre(null)}>
        {enlaces.map((e) => {
          const clases = [s.enlace, activo === e.id && s.enlaceActivo].filter(Boolean).join(' ');
          const menu = MENUS[e.menu];
          if (menu) {
            const props = e.props || (e.menu === 'tienda' ? menuTienda : e.menu === 'marcas' ? menuMarcas : {});
            const clave = `menu-${e.id}`;
            return (
              <Desplegable
                key={e.id}
                titulo={e.texto}
                alinear="izquierda"
                ancho={menu.ancho(props)}
                {...control(clave, () => onAbrirMenu?.(e.id))}
                disparador={(dp) => (
                  <button
                    type="button"
                    {...dp}
                    className={clases}
                    aria-current={activo === e.id ? 'page' : undefined}
                    onMouseEnter={() => setSobre(e.id)}
                    onFocus={() => setSobre(e.id)}
                  >
                    {pildoras(e.id)}
                    <span className={s.enlaceTexto}>
                      {textoDe(e)}
                      <ChevronDown className={[s.chevron, abierto === clave && s.chevronAbierto].filter(Boolean).join(' ')} aria-hidden="true" />
                    </span>
                  </button>
                )}
              >
                {(cerrar) => <ConMenu>{React.createElement(menu.Componente, { ...props, onNavegar: cerrar })}</ConMenu>}
              </Desplegable>
            );
          }
          return (
            <Enlace
              key={e.id}
              to={e.url}
              className={clases}
              aria-current={activo === e.id ? 'page' : undefined}
              onMouseEnter={() => setSobre(e.id)}
              onFocus={() => setSobre(e.id)}
            >
              {pildoras(e.id)}
              <span className={s.enlaceTexto}>{textoDe(e)}</span>
            </Enlace>
          );
        })}
      </nav>

      <div className={s.buscadorCaja} ref={cajaRef}>
        <Buscador placeholder={t.placeholder} onBuscar={busqueda.activo ? busqueda.buscar : onBuscar} {...busqueda.campo} />
        {busqueda.abierto && !busqueda.enHoja && (
          <div className={s.panelBusqueda} role="dialog" aria-label={t.sugerencias}>
            <PanelBusqueda {...busqueda.panel} />
          </div>
        )}
      </div>
      {busqueda.activo && (
        <HojaInferior abierta={busqueda.abierto && busqueda.enHoja} onCerrar={busqueda.cerrar} titulo={t.buscar}>
          <PanelBusqueda {...busqueda.panel} conCampo />
        </HojaInferior>
      )}

      {/* En la forma mediana las acciones van arriba y esto parte la fila. */}
      <span className={s.salto} aria-hidden="true" />

      <div className={s.acciones}>
        {onTema && <span className={s.ocultarMovil}><BotonTema tema={tema} onCambiar={onTema} /></span>}

        {usuario && (monedasCargando ? (
          <SaldoMonedas cargando />
        ) : (
          <Desplegable
            alTocar="globo"
            variante="globo"
            alinear="centro"
            ancho={300}
            {...control('monedas')}
            disparador={(props) => <SaldoMonedas saldo={monedas} {...props} />}
          >
            {(cerrar) => <ConMenu><AyudaMonedas saldo={monedas} onNavegar={cerrar} /></ConMenu>}
          </Desplegable>
        ))}

        {usuario && (
          <Desplegable
            titulo={t.notificaciones}
            ancho={370}
            {...control('notificaciones')}
            disparador={(props) => (
              <Boton
                soloIcono
                variante="fantasma"
                {...props}
                className={[s.iconoBtn, s.campana, abierto === 'notificaciones' && s.iconoActivo].filter(Boolean).join(' ')}
                aria-label={t.campana}
                insignia={<Contador valor={noLeidas} />}
              >
                <Bell aria-hidden="true" />
              </Boton>
            )}
          >
            {(cerrar) => (
              <div className={s.bandeja}>
                <div className={s.bandejaCabeza}>
                  <span><Texto>{noLeidas ? `${noLeidas} sin leer` : 'Todo al día'}</Texto></span>
                  {noLeidas > 0 && <Boton variante="fantasma" tamano="sm" onClick={onMarcarLeidas}><Texto>Marcar leídas</Texto></Boton>}
                </div>
                {avisoPush && (
                  <div className={s.avisoPush}>
                    <BellRing className={s.avisoPushIcono} aria-hidden="true" />
                    <p><Texto>Activa los avisos y te contamos cuando tu pedido avance o haya una oferta para ti.</Texto></p>
                    <Boton variante="primario" tamano="sm" cargando={avisoPush.activando} onClick={avisoPush.onActivar}>
                      <Texto>{avisoPush.activando ? 'Activando…' : 'Activar avisos'}</Texto>
                    </Boton>
                  </div>
                )}
                <div className={s.bandejaLista}>
                  <ListaNotificaciones
                    items={notificaciones}
                    limite={limiteNotificaciones}
                    vacio={vacioNotificaciones}
                    onAbrir={(n) => { onLeer?.(n.id, n); if (n.url) cerrar(); }}
                  />
                </div>
                {onVerTodas && (
                  <div className={s.bandejaPie}>
                    <Boton variante="contorno" bloque onClick={() => { cerrar(); onVerTodas(); }}>
                      <Texto>Ver todas las notificaciones</Texto>
                    </Boton>
                  </div>
                )}
              </div>
            )}
          </Desplegable>
        )}

        <span>
          <Desplegable
            alTocar="nada"
            ancho={330}
            {...control('favoritos')}
            disparador={(props) => (
              <Boton
                to={urlFavoritos}
                soloIcono
                variante="fantasma"
                {...props}
                className={[s.iconoBtn, s.corazon, abierto === 'favoritos' && s.iconoActivo].filter(Boolean).join(' ')}
                aria-label={t.favoritos}
                insignia={<Contador valor={favoritos.length} />}
              >
                <Heart aria-hidden="true" />
              </Boton>
            )}
          >
            {(cerrar) => <ConMenu><VistaFavoritos items={favoritos} sesion={Boolean(usuario)} textos={textosFavoritos} estadoLogin={estadoLogin} onNavegar={cerrar} /></ConMenu>}
          </Desplegable>
        </span>

        <Desplegable
          alTocar="nada"
          ancho={360}
          {...control('carrito')}
          disparador={(props) => (
            <Boton
              to="/carrito"
              soloIcono
              variante="fantasma"
              {...props}
              className={[s.iconoBtn, s.bolsa, abierto === 'carrito' && s.iconoActivo].filter(Boolean).join(' ')}
              aria-label={t.carrito}
              insignia={<Contador valor={enCarrito} />}
            >
              <ShoppingBag aria-hidden="true" />
            </Boton>
          )}
        >
          {(cerrar) => <ConMenu><VistaCarrito items={carrito} metaEnvio={metaEnvio} urlPagar={urlPagar} onNavegar={cerrar} /></ConMenu>}
        </Desplegable>

        {cuenta && (
        <span className={s.ocultarMovil}>
        <Desplegable
          titulo={t.cuenta}
          ancho={340}
          {...control('cuenta')}
          disparador={(props) => (
            <button type="button" {...props} className={s.avatar} aria-label={t.cuenta}>
              <Avatar className={s.avatarCara} nombre={usuario?.nombre} imagen={usuario?.avatar}><User aria-hidden="true" /></Avatar>
            </button>
          )}
        >
          {(cerrar) => (
            <ConMenu>
            <MenuCuenta
              usuario={usuario}
              grupos={gruposCuenta}
              promo={promoCuenta}
              textos={textosCuenta}
              idiomas={idiomas}
              estadoLogin={estadoLogin}
              onCerrarSesion={onCerrarSesion}
              onNavegar={cerrar}
            />
            </ConMenu>
          )}
        </Desplegable>
        </span>
        )}
      </div>
    </header>
    </div>
  );
}

/*
 * La forma de la cabecera según el ancho de su caja: 'celular' (hasta 760),
 * 'mediana' (hasta 1100) o 'ancha'. Se mide antes de pintar (sin saltos) y
 * cada vez que cambia. `celular` (true / false) lo decide quien la usa.
 */
const CORTE_CELULAR = 760;
const CORTE_MEDIANA = 1100;
function useFormaCabecera(marcoRef, celular) {
  const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useLayoutEffect(() => {
    const el = marcoRef.current;
    if (!el) return undefined;
    const medir = () => setAncho(el.offsetWidth || window.innerWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [marcoRef]);
  if (celular === true) return 'celular';
  if (celular === undefined && ancho <= CORTE_CELULAR) return 'celular';
  return ancho <= CORTE_MEDIANA ? 'mediana' : 'ancha';
}

/** Menús que puede abrir un enlace de la cabecera (enlace.menu). */
const MENUS = {
  tienda: { Componente: MenuTienda, ancho: (p) => (p.destacado ? 600 : 420) },
  marcas: { Componente: MenuMarcas, ancho: () => 500 },
  // Un desplegable de enlaces que arma el admin (o uno de colección).
  lista: { Componente: MenuTienda, ancho: () => 380 },
};

const ENLACES_POR_DEFECTO = [
  { id: 'tienda', texto: 'Tienda', url: '/tienda', menu: 'tienda' },
  { id: 'suscripciones', texto: 'Suscripciones', url: '/suscripciones' },
  { id: 'crear', texto: 'Crear', url: '/personalizar' },
  { id: 'minijuegos', texto: 'Minijuegos', url: '/minijuegos' },
];

/* La barra inferior vive en su propio archivo (la tienda la carga sin la
   cabecera); se sigue exportando desde aquí. */
export { BarraInferior } from './BarraInferior';

/** Control segmentado (Mis pedidos: Activos / Por pagar…). El fondo blanco se desliza. */
export function Pestanas({ opciones, valor, onChange, etiqueta }) {
  const uid = useId();
  return (
    <div className={s.pestanas} role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => {
        const op = typeof o === 'string' ? { id: o, texto: o } : o;
        const sel = valor === op.id;
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={sel}
            className={[s.pestana, sel && s.pestanaActiva].filter(Boolean).join(' ')}
            onClick={() => onChange(op.id)}
          >
            {sel && <motion.span layoutId={`${uid}-pestana`} className={s.pestanaFondo} transition={RESORTE} />}
            <span className={s.pestanaTexto}>
              {op.texto}
              {op.cuenta != null && <span className={s.cuenta}>{op.cuenta}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Buscador de la cabecera con panel de sugerencias (si hay buscarSugerencias):
   lo escrito, las sugerencias con un respiro entre teclas, las búsquedas
   recientes y dónde se abre (debajo del campo, o en una hoja si la cabecera
   está en su versión de celular). */
function useBuscadorConPanel({ buscarSugerencias, onBuscar, cajaRef, ideas = [], enCelular = false }) {
  const activo = typeof buscarSugerencias === 'function';
  const [abierto, setAbierto] = useState(false);
  const [enHoja, setEnHoja] = useState(false);
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const { recientes, guardar, limpiar, releer } = useBusquedasRecientes();

  useEffect(() => {
    if (!activo || !abierto || texto.trim().length < 2) { setSugerencias(null); return undefined; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      Promise.resolve(buscarSugerencias(texto.trim()))
        .then((r) => { if (vivo) setSugerencias(r || null); })
        .catch(() => { if (vivo) setSugerencias(null); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 180);
    return () => { vivo = false; clearTimeout(t); };
  }, [activo, abierto, texto, buscarSugerencias]);

  // Debajo del campo se cierra al tocar fuera o con Esc (la hoja ya lo hace sola).
  useEffect(() => {
    if (!abierto || enHoja) return undefined;
    const fuera = (e) => { if (!cajaRef.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto, enHoja, cajaRef]);

  const cerrar = () => setAbierto(false);
  const buscar = (termino) => {
    const limpio = String(termino || '').trim();
    if (limpio) guardar(limpio);
    setAbierto(false);
    setTexto('');
    onBuscar?.(limpio);
  };
  const abrir = (e) => {
    // En la forma de celular, el panel es una hoja con su propio campo.
    releer();
    setEnHoja(enCelular);
    setAbierto(true);
    if (enCelular) e.target.blur();
  };

  return {
    activo,
    abierto,
    enHoja,
    cerrar,
    buscar,
    campo: activo ? { value: texto, onChange: (e) => setTexto(e.target.value), onFocus: abrir, autoComplete: 'off', 'aria-expanded': abierto } : {},
    panel: {
      texto, onTexto: setTexto, sugerencias, buscando, recientes, ideas, onLimpiarRecientes: limpiar, onBuscar: buscar,
      onNavegar: () => { if (texto.trim()) guardar(texto); setAbierto(false); setTexto(''); },
    },
  };
}
