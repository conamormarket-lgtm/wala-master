// ¿Se dibuja el brillo mágico del dedo (el orbe y la estela)? Es de cada
// dispositivo: se guarda en localStorage y se cambia en Ajustes (solo en el
// celular, donde hay dedo). Activado si nunca se tocó.
const CLAVE = 'wala_brillo_magico';
const EVENTO = 'wala-brillo';

export function brilloActivo() {
  try {
    return window.localStorage.getItem(CLAVE) !== '0';
  } catch {
    return true;
  }
}

export function guardarBrillo(activo) {
  try {
    window.localStorage.setItem(CLAVE, activo ? '1' : '0');
  } catch { /* sin storage: solo esta vez */ }
  window.dispatchEvent(new Event(EVENTO));
}

/** Para useSyncExternalStore: avisa al cambiar aquí o en otra pestaña. */
export function escucharBrillo(avisar) {
  const enOtra = (e) => { if (e.key === CLAVE) avisar(); };
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', enOtra);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener('storage', enOtra);
  };
}
