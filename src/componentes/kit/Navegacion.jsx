import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, ShoppingBag, Brush, Gamepad2, User, Search, Heart, Bell } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import { RESORTE } from './Efectos';
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
export function Cabecera({ enCarrito = 0, monedas = 0, notificaciones = 0 }) {
  const uid = useId();
  const [activo, setActivo] = useState('Tienda');
  const [sobre, setSobre] = useState(null);
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
        <button type="button" className={`${s.iconoBtn} ${s.campana} ${s.ocultarMovil}`} aria-label={`Notificaciones (${notificaciones})`}>
          <Bell aria-hidden="true" />
          <Contador valor={notificaciones} />
        </button>
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
 * icono rebota al elegirlo y "Crear" flota al centro con un halo que gira.
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
              {destacado && <span className={s.halo} aria-hidden="true" />}
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
