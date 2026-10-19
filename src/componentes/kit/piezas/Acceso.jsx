import React, { useState } from 'react';
import { Check, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Boton from '../Boton';
import { Campo } from '../Formulario';
import { Texto, useTexto } from '../Traduccion';
import f from '../Formulario.module.css';
import s from './Acceso.module.css';

/*
 * Piezas de iniciar sesión, crear cuenta y recuperar la contraseña: el
 * campo de la contraseña (con el ojo), las reglas de la contraseña con su
 * avance, el botón de Google y la línea "o continúa con". Van aparte de
 * Formulario.jsx para no ir en el archivo principal de la tienda.
 */

// Los símbolos que acepta la política de contraseñas de Firebase Auth (ni
// `=` ni `+` cuentan): la misma lista que utils/helpers.js.
const SIMBOLO = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`-]/;

/**
 * Contraseña con el candado y el ojo para mostrarla u ocultarla (el ojo
 * parpadea al cambiar). Es un Campo: mismas etiqueta, ayuda y error.
 *  - valor · onCambiar(texto) · nueva: autocompletar como contraseña nueva
 *  - etiqueta, ayuda, error, placeholder, disabled, id, aria-describedby
 */
export function CampoContrasena({ etiqueta = 'Contraseña', valor = '', onCambiar, nueva = false, ayuda, error, placeholder, disabled, id, ...resto }) {
  const [ver, setVer] = useState(false);
  // Sus textos pasan por la traducción aquí (Campo muestra lo que recibe).
  const t = {
    etiqueta: useTexto(etiqueta),
    placeholder: useTexto(placeholder),
    ocultar: useTexto('Ocultar contraseña'),
    mostrar: useTexto('Mostrar contraseña'),
  };
  return (
    <Campo
      id={id}
      etiqueta={t.etiqueta}
      ayuda={ayuda && <Texto>{ayuda}</Texto>}
      error={error && <Texto>{error}</Texto>}
      icono={<LockKeyhole />}
      type={ver ? 'text' : 'password'}
      autoComplete={nueva ? 'new-password' : 'current-password'}
      value={valor}
      onChange={(e) => onCambiar?.(e.target.value)}
      placeholder={t.placeholder}
      disabled={disabled}
      {...resto}
      sufijo={(
        <button
          type="button"
          className={f.ojo}
          onClick={() => setVer((v) => !v)}
          disabled={disabled}
          aria-label={ver ? t.ocultar : t.mostrar}
          aria-pressed={ver}
        >
          <span key={ver ? 'si' : 'no'} className={f.ojoIcono}>{ver ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</span>
        </button>
      )}
    />
  );
}

/** Las reglas de una contraseña nueva: [{ clave, texto, cumple }]. */
export const requisitosContrasena = (p = '') => [
  { clave: 'largo', texto: '8 caracteres o más', cumple: p.length >= 8 },
  { clave: 'mayuscula', texto: 'Una mayúscula', cumple: /[A-Z]/.test(p) },
  { clave: 'minuscula', texto: 'Una minúscula', cumple: /[a-z]/.test(p) },
  { clave: 'numero', texto: 'Un número', cumple: /\d/.test(p) },
  { clave: 'simbolo', texto: 'Un símbolo (! @ # $ . -)', cumple: SIMBOLO.test(p) },
];

/** true si la contraseña cumple todas las reglas. */
export const contrasenaValida = (p) => requisitosContrasena(p).every((r) => r.cumple);

const NIVELES = ['Muy débil', 'Débil', 'Débil', 'Regular', 'Casi lista', 'Segura'];

/**
 * Las reglas de la contraseña mientras se escribe: una barra de 5 tramos que
 * se enciende con cada regla cumplida y cada regla con su visto (salta al
 * cumplirse). Sin contraseña, todo en gris.
 *  - contrasena · id: para el aria-describedby del campo
 */
export function RequisitosContrasena({ contrasena = '', id }) {
  const reglas = requisitosContrasena(contrasena);
  const n = reglas.filter((r) => r.cumple).length;
  return (
    <div id={id} className={[s.requisitos, n === reglas.length && s.requisitosListos].filter(Boolean).join(' ')} data-componente="RequisitosContrasena">
      <div className={s.fuerza}>
        <span className={s.tramos} aria-hidden="true">
          {reglas.map((r, i) => <span key={r.clave} className={i < n ? s.tramoOn : undefined} />)}
        </span>
        <span className={s.nivel} aria-live="polite"><Texto>{contrasena ? NIVELES[n] : 'Tu contraseña necesita'}</Texto></span>
      </div>
      <ul className={s.reglas}>
        {reglas.map((r) => (
          <li key={r.clave} className={r.cumple ? s.cumple : undefined}>
            <span className={s.visto} aria-hidden="true"><Check /></span>
            <Texto>{r.texto}</Texto>
            <span className={s.oculto}> <Texto>{r.cumple ? '(listo)' : '(falta)'}</Texto></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La G de Google con sus colores (no es un ícono de Walá: es su marca). */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/**
 * Entrar (o crear la cuenta) con Google: botón de contorno a lo ancho con la G.
 *  - onClick · cargando · disabled · children (por defecto "Continuar con Google")
 */
export function BotonGoogle({ onClick, cargando = false, disabled = false, children = 'Continuar con Google' }) {
  return (
    <Boton variante="contorno" bloque icono={<LogoGoogle />} onClick={onClick} cargando={cargando} disabled={disabled} className={s.google}>
      <Texto>{children}</Texto>
    </Boton>
  );
}

/** Línea con un texto al medio ("o continúa con"). */
export function SeparadorAcceso({ children = 'o continúa con' }) {
  return <p className={s.separador}><span><Texto>{children}</Texto></span></p>;
}
