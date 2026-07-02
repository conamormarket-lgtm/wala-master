// ── Parseo de User-Agent COMPARTIDO (captura y lectura) ──────────────────
// Único punto de verdad para derivar dispositivo/navegador/SO desde el UA.
// Lo usan tanto la CAPTURA (tracker.js al crear la sesión, useHeatmapTracker
// al armar el lote) como la LECTURA (adminAnalytics.js en el dashboard), de
// modo que los valores guardados y los derivados de sesiones viejas coinciden.
// SIN librerías externas: parseo a mano, tolerante a UA vacío o desconocido.

/**
 * Parsea un User-Agent crudo.
 * @param {string|null|undefined} ua - navigator.userAgent (o el UA guardado en la sesión)
 * @returns {{ device: 'Mobile'|'Tablet'|'Desktop'|'Desconocido', browser: string, os: string }}
 *   - device: 'Desconocido' SOLO si no hay UA (sesiones viejas sin el campo)
 *   - browser/os: nombre legible ('Chrome', 'Windows', ...) o 'Desconocido'
 */
export function parseUserAgent(ua) {
  if (!ua) return { browser: 'Desconocido', os: 'Desconocido', device: 'Desconocido' };
  const lower = String(ua).toLowerCase();

  // Navegador: el orden importa (Edge/Opera incluyen 'chrome'; Chrome incluye 'safari')
  let browser = 'Desconocido';
  if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg')) browser = 'Edge';
  else if (lower.includes('opr') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('safari')) browser = 'Safari';

  // Sistema operativo: Android/iOS pisan a Windows/Mac/Linux a propósito
  // (algunos UA móviles incluyen tokens de escritorio).
  let os = 'Desconocido';
  if (lower.includes('win')) os = 'Windows';
  else if (lower.includes('mac')) os = 'MacOS';
  else if (lower.includes('linux')) os = 'Linux';
  if (lower.includes('android')) os = 'Android';
  if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';

  // Dispositivo: tablets primero (iPad / 'tablet' / Android SIN 'mobi',
  // convención estándar de Android), luego móviles; el resto es escritorio.
  let device = 'Desktop';
  const isTablet =
    lower.includes('ipad') ||
    lower.includes('tablet') ||
    (lower.includes('android') && !lower.includes('mobi'));
  const isMobile =
    lower.includes('mobi') || lower.includes('iphone') || lower.includes('android');
  if (isTablet) device = 'Tablet';
  else if (isMobile) device = 'Mobile';

  return { browser, os, device };
}

export default parseUserAgent;
