// Capa táctil para Android y la web móvil, sin editar los componentes del kit.
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
  const nativeAndroid = view.Capacitor?.getPlatform?.() === 'android' && Boolean(view.Capacitor?.isNativePlatform?.());
  const timers = new Set();
  const effects = new Set();
  let active = null;
  let lastInputTouch = false;
  let viewportWidth = view.innerWidth;

  const later = (callback, delay) => {
    const id = view.setTimeout(() => { timers.delete(id); callback(); }, delay);
    timers.add(id);
    return id;
  };
  const remove = (node) => { node.remove(); effects.delete(node); };
  const position = (node, x, y) => {
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };
  const setMode = (value) => {
    if (root.getAttribute('data-wala-touch') !== value) root.setAttribute('data-wala-touch', value);
  };
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
    // Siempre mide lo mismo: representa el dedo, nunca el tamaño de una tarjeta.
    const point = effect('wala-touch-point');
    position(point, touch.clientX, touch.clientY);
    const press = { point, identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
    active = press;
    // El roce rápido deja actuar solo al kit; un gesto sostenido muestra el dedo.
    later(() => {
      if (active !== press) return;
      point.setAttribute('data-visible', 'true');
    }, 70);
  };
  // Como en Android: el toque se marca donde se apoya el dedo y, si empieza a
  // deslizar (scroll, carrusel, arrastre), se apaga ahí mismo. Antes el aro
  // seguía al dedo con JS: en las páginas pesadas iba detrás del scroll, se
  // quedaba atrás y saltaba (y Chrome no avisa del movimiento hasta ~15 px).
  const finish = (press, state) => {
    const { point } = press;
    if (active === press) active = null;
    if (!point.hasAttribute('data-visible')) { remove(point); return; }
    point.removeAttribute('data-visible');
    point.setAttribute(state, 'true');
    later(() => remove(point), 260);
  };
  const moved = (event) => {
    if (!active) return;
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === active.identifier);
    if (event.touches.length !== 1 || !touch) { cancel(); return; }
    if (Math.hypot(touch.clientX - active.x, touch.clientY - active.y) >= SLOP) finish(active, 'data-cancelled');
  };
  const up = (event) => {
    if (!active) return;
    if (!Array.from(event.changedTouches).some((candidate) => candidate.identifier === active.identifier)) return;
    finish(active, 'data-released');
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
  const clear = () => { cancel(); effects.forEach((node) => remove(node)); };
  const hidden = () => { if (doc.hidden) clear(); };
  const keyboard = () => { lastInputTouch = false; clear(); };
  const resized = () => {
    // Ocultar la barra del navegador al scrollear cambia el alto, no el gesto.
    if (viewportWidth !== view.innerWidth) clear();
    viewportWidth = view.innerWidth;
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
    listeners.forEach(([owner, name, handler, options]) => owner.removeEventListener(name, handler, options));
    timers.forEach((id) => view.clearTimeout(id));
    effects.forEach((node) => node.remove());
    root.removeAttribute('data-wala-touch');
    uninstall = undefined;
  };
  return uninstall;
}
