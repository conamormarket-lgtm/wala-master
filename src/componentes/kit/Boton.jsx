import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import s from './Boton.module.css';

/**
 * Botón de Walá. Violeta liso (sin degradado) con brillo que lo cruza al pasar
 * el ratón, halo violeta al levantarse y una onda donde se toca (también en
 * móvil). 44px de alto táctil mínimo.
 *
 *  - variante: 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'peligro'
 *  - tamano: 'sm' | 'md' | 'lg'
 *  - icono / iconoFin: nodos a izquierda / derecha (la flecha final se desliza)
 *  - cargando: spinner en lugar del icono y bloquea el clic
 *  - brillo: el destello pasa solo cada pocos segundos (CTA que debe llamar la atención)
 *  - bloque: ocupa todo el ancho
 *  - soloIcono: botón cuadrado; exige aria-label
 */
export default function Boton({
  variante = 'primario',
  tamano = 'md',
  icono,
  iconoFin,
  cargando = false,
  brillo = false,
  bloque = false,
  soloIcono = false,
  disabled,
  type = 'button',
  className,
  children,
  onPointerDown,
  ...rest
}) {
  const [ondas, setOndas] = useState([]);
  const inactivo = disabled || cargando;

  const tocar = (e) => {
    onPointerDown?.(e);
    if (inactivo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const tam = Math.max(r.width, r.height) * 2.4;
    const id = `${Date.now()}-${Math.random()}`;
    setOndas((o) => [...o.slice(-3), { id, x: e.clientX - r.left, y: e.clientY - r.top, tam }]);
  };

  const cls = [
    s.boton,
    s[variante],
    s[tamano],
    bloque && s.bloque,
    soloIcono && s.soloIcono,
    brillo && s.brilloAuto,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      disabled={inactivo}
      aria-busy={cargando || undefined}
      onPointerDown={tocar}
      {...rest}
    >
      <span className={s.destello} aria-hidden="true" />
      {ondas.map((o) => (
        <span
          key={o.id}
          className={s.onda}
          style={{ left: o.x, top: o.y, width: o.tam, height: o.tam }}
          onAnimationEnd={() => setOndas((os) => os.filter((x) => x.id !== o.id))}
          aria-hidden="true"
        />
      ))}
      <span className={s.contenido}>
        {cargando ? <Loader2 className={s.spin} aria-hidden="true" /> : icono && <span className={s.icono}>{icono}</span>}
        {children != null && <span className={s.texto}>{children}</span>}
        {!cargando && iconoFin && <span className={s.iconoFin}>{iconoFin}</span>}
      </span>
    </button>
  );
}
