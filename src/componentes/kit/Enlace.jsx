import React, { createContext, forwardRef, useContext } from 'react';

/**
 * Enlace del kit: la ÚNICA regla para resolver enlaces (antes había ~8
 * versiones distintas en las secciones del builder).
 *
 *  - Internos ("/tienda"): con <ProveedorEnlaces componente={Link}> navegan
 *    con el router de la app sin recargar; sin proveedor, <a href>.
 *  - Externos ("https://…", "wa.me", "mailto:", "tel:"): <a> en otra pestaña
 *    con rel seguro (salvo mailto/tel, que abren su app).
 *  - Anclas ("#pagar-ahora"): se desplaza suave hasta ese id en la página.
 *  - Vacío / sin `to`: se dibuja como <span> (no deja enlaces rotos).
 *  - state: el del router (p. ej. { from }); solo llega al enlace interno con proveedor.
 */
const EnlaceCtx = createContext(null);

export function ProveedorEnlaces({ componente, children }) {
  return <EnlaceCtx.Provider value={componente}>{children}</EnlaceCtx.Provider>;
}

/** Clasifica un enlace: 'interno' | 'externo' | 'ancla' | 'contacto' | null. */
export function tipoDeEnlace(to) {
  const t = String(to ?? '').trim();
  if (!t) return null;
  if (t.startsWith('#')) return 'ancla';
  if (/^(mailto:|tel:)/i.test(t)) return 'contacto';
  if (/^(https?:)?\/\//i.test(t) || /^(www\.|wa\.me\/)/i.test(t)) return 'externo';
  return 'interno';
}

const conProtocolo = (t) => (/^(www\.|wa\.me\/)/i.test(t) ? `https://${t}` : t);

export const Enlace = forwardRef(function Enlace({ to, children, onClick, state, ...rest }, ref) {
  const Componente = useContext(EnlaceCtx);
  const tipo = tipoDeEnlace(to);
  const destino = String(to ?? '').trim();

  if (!tipo) return <span ref={ref} {...rest}>{children}</span>;

  if (tipo === 'externo') {
    return (
      <a ref={ref} href={conProtocolo(destino)} target="_blank" rel="noopener noreferrer" onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }

  if (tipo === 'contacto') {
    return <a ref={ref} href={destino} onClick={onClick} {...rest}>{children}</a>;
  }

  if (tipo === 'ancla') {
    return (
      <a
        ref={ref}
        href={destino}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          const el = document.getElementById(decodeURIComponent(destino.slice(1)));
          if (!el) return;
          e.preventDefault();
          const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }

  if (Componente) {
    return <Componente ref={ref} to={destino} state={state} onClick={onClick} {...rest}>{children}</Componente>;
  }
  return <a ref={ref} href={destino} onClick={onClick} {...rest}>{children}</a>;
});
