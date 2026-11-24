export const detailEmulatorsEnabled = import.meta.env?.VITE_USE_EMULATORS === 'true'
  || import.meta.env?.MODE === 'preview'
  || (import.meta.env?.DEV && import.meta.env?.VITE_USE_EMULATORS !== 'false');

export function isEmulatorDetailUrl(value, enabled = detailEmulatorsEnabled) {
  if (!enabled) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '9199'
      && !url.username && !url.password && url.pathname.startsWith('/v0/b/demo-wala.appspot.com/o/');
  } catch { return false; }
}

// Solo se admite al normalizar explícitamente un borrador local. Nunca llega
// al guardado del catálogo, que normaliza sin allowLocal.
export function isLocalProductMediaUrl(value) {
  return typeof value === 'string' && (/^local:[\w-]{1,90}$/.test(value)
    || /^\/output\/product-media\/[\w/-]+\.(?:webp|png|jpe?g|mp4|webm)$/.test(value));
}
