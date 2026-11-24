import React, { forwardRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Enlace } from './Enlace';
import { Texto } from './Traduccion';
import s from './Boton.module.css';
import { buttonAction } from '../../utils/buttonAction.mjs';
import { IconoWhatsApp } from './IconoWhatsApp';
import '../../styles/actionButtons.css';

/**
 * Botón de Walá. Violeta por defecto, con estilos compartidos para las
 * acciones de personalizar y WhatsApp. Onda táctil y 44px de alto mínimo.
 *
 *  - variante: 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'peligro'
 *  - accion: 'personalizar' | 'whatsapp' · estilo común de esas acciones
 *  - tamano: 'sm' | 'md' | 'lg'
 *  - to: si se pasa, es un enlace (usa el router de la app vía <Enlace>)
 *  - icono / iconoFin: nodos a izquierda / derecha (la flecha final se desliza)
 *  - insignia: nodo en la esquina (p. ej. <Contador valor={3} />)
 *  - cargando: spinner en lugar del icono y bloquea el clic
 *  - brillo: el destello pasa solo cada pocos segundos (CTA de pago)
 *  - bloque: ocupa todo el ancho
 *  - soloIcono: botón cuadrado; exige aria-label
 */
const Boton = forwardRef(function Boton({
  variante = 'primario',
  accion,
  tamano = 'md',
  to,
  icono,
  iconoFin,
  insignia,
  cargando = false,
  brillo = false,
  bloque = false,
  soloIcono = false,
  disabled,
  type = 'button',
  className,
  children,
  onPointerDown,
  onClick,
  ...rest
}, ref) {
  const [ondas, setOndas] = useState([]);
  const inactivo = disabled || cargando;
  const accionVisual = buttonAction(accion, to);
  const iconoAccion = accionVisual === 'whatsapp' ? <IconoWhatsApp /> : icono;

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

  const contenido = (
    <>
      {/* Capa que recorta solo los efectos: así la insignia puede asomar
          por la esquina sin que la onda o el destello se salgan. */}
      <span className={s.recorte} aria-hidden="true">
        <span className={s.destello} />
        {ondas.map((o) => (
          <span
            key={o.id}
            className={s.onda}
            style={{ left: o.x, top: o.y, width: o.tam, height: o.tam }}
            onAnimationEnd={() => setOndas((os) => os.filter((x) => x.id !== o.id))}
          />
        ))}
      </span>
      <span className={s.contenido}>
        {cargando ? <Loader2 className={s.spin} aria-hidden="true" /> : iconoAccion && <span className={s.icono}>{iconoAccion}</span>}
        {/* Un texto suelto se traduce aquí; lo que ya viene armado (<Texto>, íconos) pasa igual. */}
        {children != null && <span className={s.texto}><Texto>{children}</Texto></span>}
        {!cargando && iconoFin && <span className={s.iconoFin}>{iconoFin}</span>}
        {/* En botones de solo icono la insignia se pega al icono, no a la
            esquina del botón (que es más grande y la dejaba suelta). */}
        {soloIcono && insignia}
      </span>
      {!soloIcono && insignia}
    </>
  );

  if (to != null) {
    return (
      <Enlace
        ref={ref}
        to={to}
        className={cls}
        data-accion={accionVisual}
        aria-disabled={inactivo || undefined}
        aria-busy={cargando || undefined}
        onPointerDown={tocar}
        onClick={(e) => { if (inactivo) { e.preventDefault(); return; } onClick?.(e); }}
        {...rest}
      >
        {contenido}
      </Enlace>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      data-accion={accionVisual}
      disabled={inactivo}
      aria-busy={cargando || undefined}
      onPointerDown={tocar}
      onClick={onClick}
      {...rest}
    >
      {contenido}
    </button>
  );
});

export default Boton;
