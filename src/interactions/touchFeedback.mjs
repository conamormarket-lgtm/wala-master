// Capa táctil para Android y la web móvil, sin editar los componentes del kit.
import { crearEstela } from './estelaMagica.mjs';
import { brilloActivo } from './preferenciaBrillo.mjs';

const TARGETS = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [data-wala-touch-target]';
const EXCLUDED = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], canvas, [draggable="true"], [data-componente="LienzoPrenda"], [data-componente="CajaVarias"], [data-wala-touch-feedback="off"]';
// Lo que puede moverse el dedo y seguir siendo un toque (como el "touch slop"
// de Android); más que eso ya es deslizar.
const SLOP = 8;
let uninstall;

export function installTouchFeedback(view = window) {
  if (uninstall) return uninstall;

  const doc = view.document;
  const root = doc.documentElement;
  const coarsePointer = view.matchMedia('(pointer: coarse)');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const nativeAndroid = view.Capacitor?.getPlatform?.() === 'android' && Boolean(view.Capacitor?.isNativePlatform?.());
  // El gesto del dedo y su brillo (estelaMagica.mjs): el orbe al mantener, la
  // estela al deslizar.
  let gesture = null;
  let estela = null;
  let lastInputTouch = false;
  let viewportWidth = view.innerWidth;

  const setMode = (value) => {
    if (root.getAttribute('data-wala-touch') !== value) root.setAttribute('data-wala-touch', value);
  };
  const targetFor = (node) => {
    if (!(node instanceof view.Element) || node.closest(EXCLUDED)) return null;
    const target = node.closest(TARGETS) || node.closest('img');
    if (!target || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"], [inert]')) return null;
    return target;
  };
  // El dedo se fue sin ser toque ni deslizamiento (dos dedos, el navegador
  // tomó el gesto): el brillo se apaga en el lugar.
  const cancel = () => {
    if (gesture) estela?.cancelar();
    gesture = null;
  };
  const syncMode = () => {
    if (nativeAndroid || coarsePointer.matches) {
      setMode(nativeAndroid ? 'android' : 'touch');
    } else {
      cancel();
      root.removeAttribute('data-wala-touch');
      lastInputTouch = false;
    }
  };
  syncMode();
  const pointerDown = (event) => {
    if (event.pointerType === 'touch') return;
    lastInputTouch = false;
    cancel();
    syncMode();
  };
  const down = (event) => {
    cancel();
    lastInputTouch = true;
    // También funciona al activar la emulación móvil sin recargar la página.
    setMode(nativeAndroid ? 'android' : 'touch');
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const target = event.target;
    if (!(target instanceof view.Element) || target.closest(EXCLUDED) || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"], [inert]')) return;
    // Sin brillo si el sistema pide menos movimiento o se apagó en Ajustes.
    if (reducedMotion.matches || !brilloActivo()) return;
    // El orbe sale solo si el dedo se queda (el motor espera 70 ms: el roce
    // rápido deja actuar solo al kit). Siempre mide lo mismo: es el dedo,
    // nunca el tamaño de una tarjeta.
    gesture = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY, trailing: false };
    estela = estela || crearEstela(view);
    // Con la hora del evento: en una página ocupada llega tarde (ver estelaMotor.mjs).
    estela.presionar(touch.clientX, touch.clientY, event.timeStamp);
  };
  // Más de SLOP es deslizar (scroll, carrusel, arrastre): el orbe se vuelve la
  // punta de la estela. La estela no persigue al dedo (en las páginas pesadas
  // iba detrás del scroll y saltaba): dibuja por donde ya pasó.
  const moved = (event) => {
    if (!gesture) return;
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === gesture.identifier);
    if (event.touches.length !== 1 || !touch) { cancel(); return; }
    if (!gesture.trailing) {
      if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) < SLOP) return;
      gesture.trailing = true;
      estela.empezar(gesture.x, gesture.y, event.timeStamp);
    }
    estela.agregar(touch.clientX, touch.clientY, event.timeStamp);
  };
  const up = (event) => {
    if (!gesture) return;
    if (!Array.from(event.changedTouches).some((candidate) => candidate.identifier === gesture.identifier)) return;
    gesture = null;
    estela?.soltar(event.timeStamp);
  };
  const contextMenu = (event) => {
    if (event.pointerType === 'mouse' || (!nativeAndroid && !lastInputTouch)) return;
    if (!targetFor(event.target)) return;
    // Solo el menú de la pulsación táctil; siguen funcionando los menús propios.
    event.preventDefault();
  };
  // Mantener el dedo y moverlo sobre un enlace o una foto empezaba a
  // ARRASTRARLOS (Android pinta una burbuja con el título y la URL): en una
  // app nativa eso no pasa. Con el dedo, nada que se toque se arrastra.
  const drag = (event) => {
    if (!lastInputTouch && !nativeAndroid) return;
    const node = event.target instanceof view.Element ? event.target : event.target?.parentElement;
    if (node && !node.closest('[draggable="true"]') && (targetFor(node) || node.closest('a[href]'))) event.preventDefault();
  };
  const clear = () => { gesture = null; estela?.limpiar(); };
  const hidden = () => { if (doc.hidden) clear(); };
  const keyboard = () => { lastInputTouch = false; clear(); };
  const resized = () => {
    // Ocultar la barra del navegador al scrollear cambia el alto, no el gesto.
    if (viewportWidth !== view.innerWidth) clear();
    viewportWidth = view.innerWidth;
    // El lienzo de la estela sí sigue al alto (la barra que se oculta).
    estela?.medir();
  };

  const listeners = [
    [doc, 'pointerdown', pointerDown, { capture: true, passive: true }],
    // El navegador cancela Pointer Events al tomar el scroll nativo. Touch Events
    // siguen entregando las coordenadas hasta levantar el dedo; nunca se bloquean.
    [doc, 'touchstart', down, { capture: true, passive: true }],
    [doc, 'touchmove', moved, { capture: true, passive: true }],
    [doc, 'touchend', up, { capture: true, passive: true }],
    [doc, 'touchcancel', cancel, { capture: true, passive: true }],
    [doc, 'contextmenu', contextMenu, { capture: true }],
    [doc, 'dragstart', drag, { capture: true }],
    [doc, 'visibilitychange', hidden, false],
    [doc, 'keydown', keyboard, { capture: true, passive: true }],
    [coarsePointer, 'change', syncMode, false],
    [view, 'blur', clear, false],
    [view, 'resize', resized, { passive: true }],
    [view, 'popstate', clear, false],
  ];
  listeners.forEach(([owner, name, handler, options]) => owner.addEventListener(name, handler, options));
  uninstall = () => {
    clear();
    estela?.quitar();
    estela = null;
    listeners.forEach(([owner, name, handler, options]) => owner.removeEventListener(name, handler, options));
    root.removeAttribute('data-wala-touch');
    uninstall = undefined;
  };
  return uninstall;
}
