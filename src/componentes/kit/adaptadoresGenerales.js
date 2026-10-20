/**
 * Desde qué aparato se abre "Descargar la app" (P23): la app de Walá es solo
 * para Android. Aparte de adaptadores.js para no ir en el archivo principal.
 *  - userAgent: el del navegador
 *  - maxTouchPoints: un iPad con iPadOS se presenta como Mac, pero es táctil
 * Devuelve 'android' | 'iphone' | 'computadora'.
 */
export function plataformaDesdeNavegador(userAgent = '', maxTouchPoints = 0) {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iphone';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'iphone';
  return 'computadora';
}
