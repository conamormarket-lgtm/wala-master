import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, ShoppingBag, Brush, Gamepad2, User, Search, Heart, Bell } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import { RESORTE } from './Efectos';
import { ListaNotificaciones } from './Feedback';
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
 * Cabecera de escritorio: logo, enlaces con píldora que sigue al ratón,
 * buscador que se ilumina al enfocarlo y accesos animados.
 */
export function Cabecera({ enCarrito = 0, monedas = 0, notificaciones = [], onLeer, onMarcarLeidas, onVerTodas }) {
  const uid = useId();
  const [activo, setActivo] = useState('Tienda');
  const [sobre, setSobre] = useState(null);
  const [bandeja, setBandeja] = useState(false);
  const bandejaRef = useRef(null);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  // Cierra la bandeja al tocar fuera o con Esc.
  useEffect(() => {
    if (!bandeja) return undefined;
    const fuera = (e) => { if (!bandejaRef.current?.contains(e.target)) setBandeja(false); };
    const esc = (e) => { if (e.key === 'Escape') setBandeja(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [bandeja]);
  const enlaces = ['Tienda', 'Suscripciones', 'Crear', 'Minijuegos'];

  return (
    <header className={s.cabecera}>
      <a href="#inicio" className={s.logo} aria-label="Walá, inicio">
        <Logo alto={36} />
      </a>

      <nav className={s.enlaces} aria-label="Principal" onMouseLeave={() => setSobre(null)}>
        {enlaces.map((e) => (
          <a
            key={e}
            href={`#${e}`}
            className={[s.enlace, activo === e && s.enlaceActivo].filter(Boolean).join(' ')}
            aria-current={activo === e ? 'page' : undefined}
            onMouseEnter={() => setSobre(e)}
            onFocus={() => setSobre(e)}
            onClick={(ev) => { ev.preventDefault(); setActivo(e); }}
          >
            {sobre === e && <motion.span layoutId={`${uid}-sobre`} className={s.pildoraSobre} transition={RESORTE} />}
            {activo === e && <motion.span layoutId={`${uid}-activo`} className={s.subrayado} transition={RESORTE} />}
            <span className={s.enlaceTexto}>{e}</span>
          </a>
        ))}
      </nav>

      <label className={s.buscador}>
        <Search aria-hidden="true" />
        <input type="search" placeholder="Buscar polos, tazas, regalos…" aria-label="Buscar productos" />
        <kbd>/</kbd>
      </label>

      <div className={s.acciones}>
        <button type="button" className={`${s.iconoBtn} ${s.soloMovil}`} aria-label="Buscar">
          <Search aria-hidden="true" />
        </button>
        <span className={s.ocultarMovil}><SaldoMonedas saldo={monedas} /></span>
        <div className={`${s.bandejaCaja} ${s.ocultarMovil}`} ref={bandejaRef}>
          <button
            type="button"
            className={[s.iconoBtn, s.campana, bandeja && s.iconoActivo].filter(Boolean).join(' ')}
            aria-label={`Notificaciones (${noLeidas} sin leer)`}
            aria-expanded={bandeja}
            onClick={() => setBandeja((v) => !v)}
          >
            <Bell aria-hidden="true" />
            <Contador valor={noLeidas} />
          </button>
          <AnimatePresence>
            {bandeja && (
              <motion.div
                className={s.bandeja}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={s.bandejaCabeza}>
                  <strong>Notificaciones</strong>
                  {noLeidas > 0 && <button type="button" onClick={onMarcarLeidas}>Marcar leídas</button>}
                </div>
                <div className={s.bandejaLista}>
                  <ListaNotificaciones items={notificaciones} limite={5} onAbrir={(n) => onLeer?.(n.id)} />
                </div>
                <button type="button" className={s.bandejaTodas} onClick={() => { setBandeja(false); onVerTodas?.(); }}>
                  Ver todas las notificaciones
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button type="button" className={`${s.iconoBtn} ${s.corazon} ${s.ocultarMovil}`} aria-label="Deseos">
          <Heart aria-hidden="true" />
        </button>
        <button type="button" className={`${s.iconoBtn} ${s.bolsa}`} aria-label={`Carrito (${enCarrito})`}>
          <ShoppingBag aria-hidden="true" />
          <Contador valor={enCarrito} />
        </button>
        <button type="button" className={s.avatar} aria-label="Mi cuenta">
          <span>IC</span>
        </button>
      </div>
    </header>
  );
}

const TABS = [
  { id: 'inicio', texto: 'Inicio', Icono: Home },
  { id: 'tienda', texto: 'Tienda', Icono: ShoppingBag },
  { id: 'crear', texto: 'Crear', Icono: Brush, destacado: true },
  { id: 'juegos', texto: 'Juegos', Icono: Gamepad2 },
  { id: 'cuenta', texto: 'Cuenta', Icono: User },
];

/**
 * Barra inferior móvil. La píldora del activo se desliza entre tabs, el
 * icono rebota al elegirlo y "Crear" va destacado al centro.
 */
export function BarraInferior({ carrito = 0 }) {
  const uid = useId();
  const [activo, setActivo] = useState('tienda');
  return (
    <nav className={s.barra} aria-label="Navegación principal">
      {TABS.map(({ id, texto, Icono, destacado }) => {
        const esActivo = activo === id;
        return (
          <button
            key={id}
            type="button"
            className={[s.tab, esActivo && s.tabActivo, destacado && s.tabDestacado].filter(Boolean).join(' ')}
            aria-current={esActivo ? 'page' : undefined}
            onClick={() => setActivo(id)}
          >
            <span className={s.tabIcono}>
              {esActivo && !destacado && (
                <motion.span layoutId={`${uid}-tab`} className={s.tabPildora} transition={RESORTE} />
              )}
              <Icono key={esActivo ? 'on' : 'off'} className={esActivo ? s.rebota : undefined} aria-hidden="true" />
              {id === 'tienda' && <Contador valor={carrito} />}
            </span>
            <span className={s.tabTexto}>{texto}</span>
          </button>
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
