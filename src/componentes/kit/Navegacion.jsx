import React, { useState } from 'react';
import { Home, ShoppingBag, Brush, Gamepad2, User, Search, Heart, Bell } from 'lucide-react';
import { Contador, SaldoMonedas } from './Etiquetas';
import s from './Navegacion.module.css';

/**
 * Logo de marca: las mismas dos máscaras que el Header (forma con el violeta
 * de marca + la W calada en blanco), igual en claro y en oscuro.
 */
export function Logo({ alto = 32 }) {
  return (
    <span className={s.logoMarca} style={{ height: alto }} role="img" aria-label="Walá">
      <span className={s.logoForma} aria-hidden="true" />
      <span className={s.logoHuecos} aria-hidden="true" />
    </span>
  );
}

/** Cabecera de escritorio: logo, enlaces, buscador y accesos. */
export function Cabecera({ enCarrito = 0, monedas = 0, notificaciones = 0 }) {
  const [activo, setActivo] = useState('Tienda');
  const enlaces = ['Tienda', 'Suscripciones', 'Crear', 'Minijuegos'];
  return (
    <header className={s.cabecera}>
      <a href="#inicio" className={s.logo} aria-label="Walá, inicio">
        <Logo alto={36} />
      </a>

      <nav className={s.enlaces} aria-label="Principal">
        {enlaces.map((e) => (
          <a
            key={e}
            href={`#${e}`}
            className={[s.enlace, activo === e && s.enlaceActivo].filter(Boolean).join(' ')}
            aria-current={activo === e ? 'page' : undefined}
            onClick={(ev) => { ev.preventDefault(); setActivo(e); }}
          >
            {e}
          </a>
        ))}
      </nav>

      <label className={s.buscador}>
        <Search aria-hidden="true" />
        <input type="search" placeholder="Buscar polos, tazas, regalos…" aria-label="Buscar productos" />
        <kbd>/</kbd>
      </label>

      <div className={s.acciones}>
        <SaldoMonedas saldo={monedas} />
        <button type="button" className={s.iconoBtn} aria-label={`Notificaciones (${notificaciones})`}>
          <Bell aria-hidden="true" />
          <Contador valor={notificaciones} />
        </button>
        <button type="button" className={s.iconoBtn} aria-label="Deseos">
          <Heart aria-hidden="true" />
        </button>
        <button type="button" className={s.iconoBtn} aria-label={`Carrito (${enCarrito})`}>
          <ShoppingBag aria-hidden="true" />
          <Contador valor={enCarrito} />
        </button>
        <button type="button" className={s.avatar} aria-label="Mi cuenta">IC</button>
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
 * Barra inferior móvil. El tab activo lleva una píldora detrás del icono
 * (antes solo cambiaba el color) y "Crear" va destacado al centro.
 */
export function BarraInferior({ carrito = 0 }) {
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
              <Icono aria-hidden="true" />
              {id === 'tienda' && <Contador valor={carrito} />}
            </span>
            <span className={s.tabTexto}>{texto}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Control segmentado (Mis pedidos: Activos / Entregados / Todos…). */
export function Pestanas({ opciones, valor, onChange, etiqueta }) {
  return (
    <div className={s.pestanas} role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => {
        const op = typeof o === 'string' ? { id: o, texto: o } : o;
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={valor === op.id}
            className={[s.pestana, valor === op.id && s.pestanaActiva].filter(Boolean).join(' ')}
            onClick={() => onChange(op.id)}
          >
            {op.texto}
            {op.cuenta != null && <span className={s.cuenta}>{op.cuenta}</span>}
          </button>
        );
      })}
    </div>
  );
}
