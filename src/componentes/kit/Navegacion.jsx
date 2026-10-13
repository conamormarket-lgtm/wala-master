import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, ShoppingBag, Brush, Gamepad2, User, Heart, Bell, ChevronDown, Shield } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import Boton from './Boton';
import { Buscador } from './Formulario';
import { RESORTE } from './Efectos';
import { ListaNotificaciones } from './Feedback';
import { Enlace } from './Enlace';
import Desplegable from './Desplegable';
import { MenuTienda, MenuMarcas, AyudaMonedas, MenuCuenta, VistaFavoritos, VistaCarrito } from './MenusCabecera';
import { BotonTema } from './piezas/Marco';
import s from './Navegacion.module.css';

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
 *  - enlaces: [{ id, texto, url, menu?: 'tienda' | 'marcas' }]   activo: id actual
 *  - menuTienda: props de <MenuTienda>  · menuMarcas: props de <MenuMarcas>
 *  - tema: 'claro' | 'noche' + onTema → botón de tema (solo escritorio)
 *  - monedas, notificaciones (+ onLeer, onMarcarLeidas, onVerTodas)
 *  - usuario, gruposCuenta, promoCuenta, onCerrarSesion
 *  - favoritos: [{ id, nombre, imagen }]   carrito: [{ id, nombre, imagen, precio, cantidad, variante }]
 *
 * Monedas y notificaciones solo aparecen con sesión. En el celular la
 * cabecera tiene dos filas (como la tienda): logo y accesos arriba, el
 * buscador abajo; la cuenta va en la barra inferior.
 */
export function Cabecera({
  enlaces = ENLACES_POR_DEFECTO,
  activo = 'tienda',
  menuTienda = {},
  menuMarcas = {},
  tema,
  onTema,
  monedas = 0,
  notificaciones = [],
  onLeer,
  onMarcarLeidas,
  onVerTodas,
  usuario = null,
  gruposCuenta = [],
  promoCuenta,
  onCerrarSesion,
  favoritos = [],
  carrito = [],
  onBuscar,
  placeholder = 'Buscar productos y marcas',
}) {
  const uid = useId();
  const [sobre, setSobre] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  // Un solo menú abierto a la vez.
  const control = (clave) => ({
    abierto: abierto === clave,
    onAbiertoChange: (v) => setAbierto((prev) => (v ? clave : prev === clave ? null : prev)),
  });

  const pildoras = (id) => (
    <>
      {sobre === id && <motion.span layoutId={`${uid}-sobre`} className={s.pildoraSobre} transition={RESORTE} />}
      {activo === id && <motion.span layoutId={`${uid}-activo`} className={s.subrayado} transition={RESORTE} />}
    </>
  );

  return (
    <header className={s.cabecera}>
      <Enlace to="/" className={s.logo} aria-label="Walá, inicio">
        <Logo alto={36} />
      </Enlace>

      <nav className={s.enlaces} aria-label="Principal" onMouseLeave={() => setSobre(null)}>
        {enlaces.map((e) => {
          const clases = [s.enlace, activo === e.id && s.enlaceActivo].filter(Boolean).join(' ');
          const menu = MENUS[e.menu];
          if (menu) {
            const props = e.menu === 'tienda' ? menuTienda : menuMarcas;
            return (
              <Desplegable
                key={e.id}
                titulo={e.texto}
                alinear="izquierda"
                ancho={menu.ancho(props)}
                {...control(e.menu)}
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
                      {e.texto}
                      <ChevronDown className={[s.chevron, abierto === e.menu && s.chevronAbierto].filter(Boolean).join(' ')} aria-hidden="true" />
                    </span>
                  </button>
                )}
              >
                {(cerrar) => React.createElement(menu.Componente, { ...props, onNavegar: cerrar })}
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
              <span className={s.enlaceTexto}>{e.texto}</span>
            </Enlace>
          );
        })}
      </nav>

      <div className={s.buscadorCaja}>
        <Buscador placeholder={placeholder} onBuscar={onBuscar} />
      </div>

      <div className={s.acciones}>
        {onTema && <span className={s.ocultarMovil}><BotonTema tema={tema} onCambiar={onTema} /></span>}

        {usuario && (
          <Desplegable
            alTocar="globo"
            variante="globo"
            alinear="centro"
            ancho={300}
            {...control('monedas')}
            disparador={(props) => <SaldoMonedas saldo={monedas} {...props} />}
          >
            {(cerrar) => <AyudaMonedas saldo={monedas} onNavegar={cerrar} />}
          </Desplegable>
        )}

        {usuario && (
          <Desplegable
            titulo="Notificaciones"
            ancho={370}
            {...control('notificaciones')}
            disparador={(props) => (
              <Boton
                soloIcono
                variante="fantasma"
                {...props}
                className={[s.iconoBtn, s.campana, abierto === 'notificaciones' && s.iconoActivo].filter(Boolean).join(' ')}
                aria-label={`Notificaciones (${noLeidas} sin leer)`}
                insignia={<Contador valor={noLeidas} />}
              >
                <Bell aria-hidden="true" />
              </Boton>
            )}
          >
            {(cerrar) => (
              <div className={s.bandeja}>
                <div className={s.bandejaCabeza}>
                  <span>{noLeidas ? `${noLeidas} sin leer` : 'Todo al día'}</span>
                  {noLeidas > 0 && <Boton variante="fantasma" tamano="sm" onClick={onMarcarLeidas}>Marcar leídas</Boton>}
                </div>
                <div className={s.bandejaLista}>
                  <ListaNotificaciones items={notificaciones} limite={5} onAbrir={(n) => onLeer?.(n.id)} />
                </div>
                <div className={s.bandejaPie}>
                  <Boton variante="contorno" bloque onClick={() => { cerrar(); onVerTodas?.(); }}>
                    Ver todas las notificaciones
                  </Boton>
                </div>
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
                to="/cuenta/wishlist"
                soloIcono
                variante="fantasma"
                {...props}
                className={[s.iconoBtn, s.corazon, abierto === 'favoritos' && s.iconoActivo].filter(Boolean).join(' ')}
                aria-label={`Favoritos (${favoritos.length})`}
                insignia={<Contador valor={favoritos.length} />}
              >
                <Heart aria-hidden="true" />
              </Boton>
            )}
          >
            {(cerrar) => <VistaFavoritos items={favoritos} sesion={Boolean(usuario)} onNavegar={cerrar} />}
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
              aria-label={`Carrito (${enCarrito})`}
              insignia={<Contador valor={enCarrito} />}
            >
              <ShoppingBag aria-hidden="true" />
            </Boton>
          )}
        >
          {(cerrar) => <VistaCarrito items={carrito} onNavegar={cerrar} />}
        </Desplegable>

        <span className={s.ocultarMovil}>
        <Desplegable
          titulo="Mi cuenta"
          ancho={320}
          {...control('cuenta')}
          disparador={(props) => (
            <button type="button" {...props} className={s.avatar} aria-label="Mi cuenta">
              {usuario?.avatar ? (
                <img src={usuario.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{usuario ? iniciales(usuario.nombre) : <User aria-hidden="true" />}</span>
              )}
            </button>
          )}
        >
          {(cerrar) => (
            <MenuCuenta usuario={usuario} grupos={gruposCuenta} promo={promoCuenta} onCerrarSesion={onCerrarSesion} onNavegar={cerrar} />
          )}
        </Desplegable>
        </span>
      </div>
    </header>
  );
}

/** Menús que puede abrir un enlace de la cabecera (enlace.menu). */
const MENUS = {
  tienda: { Componente: MenuTienda, ancho: (p) => (p.destacado ? 720 : 560) },
  marcas: { Componente: MenuMarcas, ancho: () => 500 },
};

const iniciales = (nombre) => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const ENLACES_POR_DEFECTO = [
  { id: 'tienda', texto: 'Tienda', url: '/tienda', menu: 'tienda' },
  { id: 'suscripciones', texto: 'Suscripciones', url: '/suscripciones' },
  { id: 'crear', texto: 'Crear', url: '/personalizar' },
  { id: 'minijuegos', texto: 'Minijuegos', url: '/minijuegos' },
];

const TABS = [
  { id: 'inicio', texto: 'Inicio', url: '/', Icono: Home },
  { id: 'tienda', texto: 'Tienda', url: '/tienda', Icono: ShoppingBag },
  { id: 'crear', texto: 'Crear', url: '/personalizar', Icono: Brush, destacado: true },
  { id: 'juegos', texto: 'Juegos', url: '/minijuegos', Icono: Gamepad2 },
  { id: 'cuenta', texto: 'Mi cuenta', url: '/cuenta', Icono: User },
];

const TAB_ADMIN = { id: 'admin', texto: 'Admin', url: '/admin', Icono: Shield };

/**
 * Barra inferior móvil. La píldora del activo se desliza entre tabs, el
 * icono rebota al elegirlo y "Crear" va destacado al centro.
 *  - activo: id de la pestaña de la ruta actual (la tienda lo saca de la
 *    URL). Sin él, la barra recuerda la última tocada (demo).
 *  - usuario: { nombre, avatar } → su foto o iniciales en "Mi cuenta"
 *  - admin: agrega la pestaña Admin
 *  - items: para cambiar las pestañas ({ id, texto, url, Icono, destacado })
 */
export function BarraInferior({ items = TABS, activo, usuario, admin = false, carrito = 0, onNavegar }) {
  const uid = useId();
  const [propio, setPropio] = useState('inicio');
  const actual = activo ?? propio;
  const tabs = admin ? [...items, TAB_ADMIN] : items;
  return (
    <nav className={s.barra} aria-label="Navegación principal">
      {tabs.map(({ id, texto, url, Icono, destacado }) => {
        const esActivo = actual === id;
        const conAvatar = id === 'cuenta' && usuario;
        return (
          <Enlace
            key={id}
            to={url}
            className={[s.tab, esActivo && s.tabActivo, destacado && s.tabDestacado].filter(Boolean).join(' ')}
            aria-current={esActivo ? 'page' : undefined}
            onClick={(e) => {
              if (activo === undefined) { e.preventDefault(); setPropio(id); }
              onNavegar?.(id);
            }}
          >
            <span className={s.tabIcono}>
              {esActivo && !destacado && (
                <motion.span layoutId={`${uid}-tab`} className={s.tabPildora} transition={RESORTE} />
              )}
              {conAvatar ? (
                <span className={[s.tabAvatar, esActivo && s.rebota].filter(Boolean).join(' ')} aria-hidden="true">
                  {usuario.avatar ? <img src={usuario.avatar} alt="" referrerPolicy="no-referrer" /> : iniciales(usuario.nombre)}
                </span>
              ) : (
                <Icono key={esActivo ? 'on' : 'off'} className={esActivo ? s.rebota : undefined} aria-hidden="true" />
              )}
              {id === 'tienda' && <Contador valor={carrito} />}
            </span>
            <span className={s.tabTexto}>{texto}</span>
          </Enlace>
        );
      })}
    </nav>
  );
}

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
