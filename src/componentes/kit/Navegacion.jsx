import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, User, Heart, Bell, ChevronDown } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import Boton from './Boton';
import { Buscador } from './Formulario';
import { RESORTE } from './Efectos';
import { ListaNotificaciones, HojaInferior } from './Feedback';
import { Enlace } from './Enlace';
import Desplegable from './Desplegable';
import { MenuTienda, MenuMarcas, AyudaMonedas, MenuCuenta, VistaFavoritos, VistaCarrito } from './MenusCabecera';
import { BotonTema } from './piezas/Marco';
import { Avatar } from './piezas/Avatar';
import { PanelBusqueda, useBusquedasRecientes } from './piezas/PanelBusqueda';
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
 *  - favoritos: [{ id, nombre, imagen }]   carrito: [{ id, nombre, imagen, precio, cantidad, variante, url }]
 *  - metaEnvio: monto del envío gratis (barra en el menú del carrito)
 *  - onBuscar(termino): ir a los resultados
 *  - buscarSugerencias(texto) → promesa de sugerencias (PanelBusqueda): con
 *    ella, el buscador abre el panel (recientes y sugerencias) debajo del
 *    campo; en el celular, una hoja con su propio campo. Sin ella, solo Enter.
 *  - ideasBusqueda: términos para "Lo más buscado" en el panel
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
  metaEnvio,
  onBuscar,
  buscarSugerencias,
  ideasBusqueda = [],
  placeholder = 'Buscar productos y marcas',
}) {
  const uid = useId();
  const cajaRef = useRef(null);
  const busqueda = useBuscadorConPanel({ buscarSugerencias, onBuscar, cajaRef, ideas: ideasBusqueda });
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
    <div className={s.cabeceraCaja}>
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

      <div className={s.buscadorCaja} ref={cajaRef}>
        <Buscador placeholder={placeholder} onBuscar={busqueda.activo ? busqueda.buscar : onBuscar} {...busqueda.campo} />
        {busqueda.abierto && !busqueda.enHoja && (
          <div className={s.panelBusqueda} role="dialog" aria-label="Sugerencias de búsqueda">
            <PanelBusqueda {...busqueda.panel} />
          </div>
        )}
      </div>
      {busqueda.activo && (
        <HojaInferior abierta={busqueda.abierto && busqueda.enHoja} onCerrar={busqueda.cerrar} titulo="Buscar">
          <PanelBusqueda {...busqueda.panel} conCampo />
        </HojaInferior>
      )}

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
          {(cerrar) => <VistaCarrito items={carrito} metaEnvio={metaEnvio} onNavegar={cerrar} />}
        </Desplegable>

        <span className={s.ocultarMovil}>
        <Desplegable
          titulo="Mi cuenta"
          ancho={340}
          {...control('cuenta')}
          disparador={(props) => (
            <button type="button" {...props} className={s.avatar} aria-label="Mi cuenta">
              <Avatar className={s.avatarCara} nombre={usuario?.nombre} imagen={usuario?.avatar}><User aria-hidden="true" /></Avatar>
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
    </div>
  );
}

/** Menús que puede abrir un enlace de la cabecera (enlace.menu). */
const MENUS = {
  tienda: { Componente: MenuTienda, ancho: (p) => (p.destacado ? 600 : 420) },
  marcas: { Componente: MenuMarcas, ancho: () => 500 },
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
function useBuscadorConPanel({ buscarSugerencias, onBuscar, cajaRef, ideas = [] }) {
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
    // La cabecera pasa a dos filas (celular) a los 760 px de ancho.
    const angosta = (cajaRef.current?.closest('header')?.offsetWidth || 1000) <= 760;
    releer();
    setEnHoja(angosta);
    setAbierto(true);
    if (angosta) e.target.blur();
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
