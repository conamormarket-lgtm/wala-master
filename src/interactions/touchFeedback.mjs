// Capa táctil para Android y la web móvil, sin editar los componentes del kit.
const TARGETS = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [data-wala-touch-target]';
const EXCLUDED = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], canvas, [draggable="true"], [data-componente="LienzoPrenda"], [data-componente="CajaVarias"], [data-wala-touch-feedback="off"]';
let uninstall;

export function installTouchFeedback(view = window) {
  if (uninstall) return uninstall;

  const doc = view.document;
  const root = doc.documentElement;
  const coarsePointer = view.matchMedia('(pointer: coarse)');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
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
  const position = (node, x, y, angle = 0) => {
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle}deg)`;
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
    if (active) {
      view.cancelAnimationFrame(active.frame);
      view.clearTimeout(active.trailTimer);
      timers.delete(active.trailTimer);
      remove(active.point);
    }
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
    const press = {
      point, identifier: touch.identifier,
      x: touch.clientX, y: touch.clientY,
      renderedX: touch.clientX, renderedY: touch.clientY,
      frame: 0, trailTimer: 0, trailsShown: false, lastMotion: 0, angle: 0, lastRender: 0, trail: 0,
    };
    active = press;
    // El roce rápido deja actuar solo al kit; un gesto sostenido muestra el dedo.
    later(() => {
      if (active !== press) return;
      point.setAttribute('data-visible', 'true');
    }, 70);
  };
  const hideTrailWhenIdle = (press) => {
    press.trailTimer = 0;
    if (active !== press) return;
    const remaining = 90 - (view.performance.now() - press.lastMotion);
    if (remaining > 0) {
      press.trailTimer = later(() => hideTrailWhenIdle(press), remaining);
      return;
    }
    press.point.removeAttribute('data-moving');
    press.point.style.setProperty('--estela', '0');
    press.trail = 0;
    press.trailsShown = false;
  };
  const render = (press) => {
    press.frame = 0;
    if (active !== press) return;
    const dx = press.x - press.renderedX;
    const dy = press.y - press.renderedY;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const now = view.performance.now();
    if (press.lastMotion && distance >= 1) {
      const direction = Math.atan2(dy, dx) * 180 / Math.PI;
      const turn = (((direction - press.angle) % 360 + 540) % 360) - 180;
      press.angle += turn;
    }
    // Una sola capa para círculo y estela; no recalcula el layout al moverla.
    position(press.point, press.x, press.y, press.angle);
    press.renderedX = press.x;
    press.renderedY = press.y;
    // La estela crece con la velocidad (1,2 px/ms = larga del todo) y se suaviza
    // entre frames para que no tiemble. Solo se escribe si cambia de verdad.
    const elapsed = press.lastRender ? now - press.lastRender : 16;
    press.lastRender = now;
    const trail = press.trail * 0.6 + Math.min(1, distance / Math.max(elapsed, 8) / 1.2) * 0.4;
    if (Math.abs(trail - press.trail) >= 0.04) press.point.style.setProperty('--estela', trail.toFixed(2));
    press.trail = trail;
    if (!press.lastMotion || now - press.lastMotion >= 90 || reducedMotion.matches || !press.point.hasAttribute('data-visible')) return;
    if (!press.trailsShown) press.point.setAttribute('data-moving', 'true');
    press.trailsShown = true;
    // Al detener el dedo se borra la estela, aunque siga apoyado.
    // Un solo temporizador activo, sin crearlo de nuevo en cada frame.
    if (!press.trailTimer) press.trailTimer = later(() => hideTrailWhenIdle(press), 90);
  };
  const moved = (event) => {
    if (!active) return;
    if (event.touches.length !== 1) { cancel(); return; }
    const touch = event.touches[0];
    if (touch.identifier !== active.identifier) { cancel(); return; }
    if (Math.hypot(touch.clientX - active.x, touch.clientY - active.y) >= 3) active.lastMotion = view.performance.now();
    active.x = touch.clientX;
    active.y = touch.clientY;
    const press = active;
    if (!press.frame) press.frame = view.requestAnimationFrame(() => render(press));
  };
  const up = (event) => {
    if (!active) return;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === active.identifier);
    if (!touch) return;
    const press = active;
    view.cancelAnimationFrame(press.frame);
    press.x = touch.clientX;
    press.y = touch.clientY;
    render(press);
    const { point } = press;
    point.removeAttribute('data-moving');
    if (point.hasAttribute('data-visible')) {
      point.removeAttribute('data-visible');
      point.setAttribute('data-released', 'true');
      later(() => remove(point), 260);
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
