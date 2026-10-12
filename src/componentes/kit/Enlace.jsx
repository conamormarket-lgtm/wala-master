import React, { createContext, forwardRef, useContext } from 'react';

/**
 * Enlace del kit. Por defecto es un <a href>. Dentro de la app se envuelve
 * todo en <ProveedorEnlaces componente={Link}> (react-router) y cada Enlace
 * pasa a navegar sin recargar, sin que los componentes sepan del router.
 */
const EnlaceCtx = createContext(null);

export function ProveedorEnlaces({ componente, children }) {
  return <EnlaceCtx.Provider value={componente}>{children}</EnlaceCtx.Provider>;
}

export const Enlace = forwardRef(function Enlace({ to, children, ...rest }, ref) {
  const Componente = useContext(EnlaceCtx);
  if (Componente) {
    return <Componente ref={ref} to={to} {...rest}>{children}</Componente>;
  }
  return <a ref={ref} href={to} {...rest}>{children}</a>;
});
