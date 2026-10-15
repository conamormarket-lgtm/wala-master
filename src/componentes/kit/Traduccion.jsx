import React, { createContext, useContext } from 'react';

/*
 * Traducción del kit: la misma idea que ProveedorEnlaces. El kit no traduce
 * por su cuenta; la tienda le pasa cómo hacerlo y los textos que vienen de
 * los datos (nombres de producto, categorías, títulos del builder,
 * descripciones) pasan por ahí.
 *
 * En la tienda:
 *   <ProveedorTraduccion texto={useTranslatedText} html={useTranslatedHtml}>
 * (src/i18n/useTranslatedText.js: muestran el original mientras llega la
 * traducción y no tocan la red en español).
 *
 * Sin proveedor (la página de componentes, los tests) todo queda igual.
 */

const TraduccionCtx = createContext(null);

/**
 *  - texto: un hook (texto) → texto traducido (useTranslatedText)
 *  - html: un hook (html) → html traducido (useTranslatedHtml)
 * Son hooks: el proveedor no debe cambiar de uno a otro mientras la página vive.
 */
export function ProveedorTraduccion({ texto, html, children }) {
  return <TraduccionCtx.Provider value={{ texto, html }}>{children}</TraduccionCtx.Provider>;
}

const igual = (x) => x;

/** Un texto de los datos, traducido si hay proveedor. */
export function useTexto(texto) {
  const usar = useContext(TraduccionCtx)?.texto || igual;
  return usar(typeof texto === 'string' ? texto : undefined) ?? texto;
}

/** HTML de los datos (la descripción de un producto), traducido si hay proveedor. */
export function useHtml(html) {
  const usar = useContext(TraduccionCtx)?.html || igual;
  return usar(html) ?? html;
}

/** <Texto>{producto.nombre}</Texto>: lo mismo que useTexto, para usar en JSX. Lo que no es texto pasa igual. */
export function Texto({ children }) {
  const t = useTexto(children);
  return typeof children === 'string' ? t : children;
}
