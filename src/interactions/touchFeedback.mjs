// Capa táctil para Android y la web móvil, sin editar los componentes del kit.
const TARGETS = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [data-wala-touch-target]';
const EXCLUDED = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], canvas, [draggable="true"], [data-componente="LienzoPrenda"], [data-componente="CajaVarias"], [data-wala-touch-feedback="off"]';
let uninstall;

export function installTouchFeedback(view = window) {
  if (uninstall) return uninstall;

  const doc = view.document;
  const root = doc.documentElement;
  const coarsePointer = view.matchMedia('(pointer: coarse)');
  const nativeAndroid = view.Capacitor?.getPlatform?.() === 'android' && Boolean(view.Capacitor?.isNativePlatform?.());
  const timers = new Set();
  const effects = new Set();
  let active = null;
  let lastInputTouch = false;

  const later = (callback, delay) => {
    const id = view.setTimeout(() => { timers.delete(id); callback(); }, delay);
    timers.add(id);
  };
  const remove = (node) => { node.remove(); effects.delete(node); };
  const targetFor = (node) => {
    if (!(node instanceof view.Element) || node.closest(EXCLUDED)) return null;
    const target = node.closest(TARGETS) || node.closest('img');
    if (!target || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"], [inert]')) return null;
    return target;
  };
  const effect = (className) => {
    const node = doc.createElement('div');
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    doc.body.append(node);
    effects.add(node);
    return node;
  };
  const cancel = () => {
    if (active) remove(active.point);
    active = null;
  };
  const syncMode = () => {
    if (nativeAndroid || coarsePointer.matches) {
      root.setAttribute('data-wala-touch', nativeAndroid ? 'android' : 'touch');
    } else {
      cancel();
      root.removeAttribute('data-wala-touch');
      lastInputTouch = false;
    }
  };
  syncMode();
  const down = (event) => {
    cancel();
    lastInputTouch = event.pointerType === 'touch';
    if (!lastInputTouch) { syncMode(); return; }
    // También funciona al activar la emulación móvil sin recargar la página.
    root.setAttribute('data-wala-touch', nativeAndroid ? 'android' : 'touch');
    if (!event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof view.Element) || target.closest(EXCLUDED) || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"], [inert]')) return;
    // Siempre mide lo mismo: representa el dedo, nunca el tamaño de una tarjeta.
    const point = effect('wala-touch-point');
    point.style.left = `${event.clientX}px`;
    point.style.top = `${event.clientY}px`;
    const press = { target, point, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    active = press;
    // El roce o el inicio de un desplazamiento deja actuar solo al kit.
    later(() => {
      if (active !== press) return;
      if (!target.isConnected) { cancel(); return; }
      point.setAttribute('data-visible', 'true');
    }, 70);
  };
  const moved = (event) => {
    if (active?.pointerId === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) cancel();
  };
  const up = (event) => {
    if (!active || active.pointerId !== event.pointerId) return;
    moved(event);
    if (!active) return;
    const { point } = active;
    if (point.hasAttribute('data-visible')) {
      point.removeAttribute('data-visible');
      point.setAttribute('data-released', 'true');
      later(() => remove(point), 180);
    } else remove(point);
    active = null;
  };
  const contextMenu = (event) => {
    if (event.pointerType === 'mouse' || (!nativeAndroid && !lastInputTouch)) return;
    if (!targetFor(event.target)) return;
    // Solo el menú de la pulsación táctil; siguen funcionando los menús propios.
    event.preventDefault();
  };
  const drag = (event) => {
    if (lastInputTouch && event.target instanceof view.Element && event.target.matches('img') && targetFor(event.target)) event.preventDefault();
  };
  const clear = () => { cancel(); effects.forEach((node) => remove(node)); };
  const hidden = () => { if (doc.hidden) clear(); };
  const keyboard = () => { lastInputTouch = false; clear(); };
  const scroll = (event) => {
    if (!active) return;
    const scroller = event.target;
    // Un carrusel automático de otra sección no debe apagar el toque.
    if (scroller === doc || (scroller instanceof view.Element && scroller.contains(active.target))) cancel();
  };
  const listeners = [
    [doc, 'pointerdown', down, { capture: true, passive: true }],
    [doc, 'pointermove', moved, { capture: true, passive: true }],
    [doc, 'pointerup', up, { capture: true, passive: true }],
    [doc, 'pointercancel', cancel, { capture: true, passive: true }],
    [doc, 'scroll', scroll, { capture: true, passive: true }],
    [doc, 'contextmenu', contextMenu, { capture: true }],
    [doc, 'dragstart', drag, { capture: true }],
    [doc, 'visibilitychange', hidden, false],
    [doc, 'keydown', keyboard, { capture: true, passive: true }],
    [coarsePointer, 'change', syncMode, false],
    [view, 'blur', clear, false],
    [view, 'resize', clear, { passive: true }],
    [view, 'popstate', clear, false],
  ];
  listeners.forEach(([owner, name, handler, options]) => owner.addEventListener(name, handler, options));
  uninstall = () => {
    clear();
    listeners.forEach(([owner, name, handler, options]) => owner.removeEventListener(name, handler, options));
    timers.forEach((id) => view.clearTimeout(id));
    effects.forEach((node) => node.remove());
    root.removeAttribute('data-wala-touch');
    uninstall = undefined;
  };
  return uninstall;
}
