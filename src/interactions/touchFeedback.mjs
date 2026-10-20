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
      remove(active.point);
      active.trails.forEach(remove);
    }
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
    root.setAttribute('data-wala-touch', nativeAndroid ? 'android' : 'touch');
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const target = event.target;
    if (!(target instanceof view.Element) || target.closest(EXCLUDED) || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"], [inert]')) return;
    // Siempre mide lo mismo: representa el dedo, nunca el tamaño de una tarjeta.
    const point = effect('wala-touch-point');
    point.style.left = `${touch.clientX}px`;
    point.style.top = `${touch.clientY}px`;
    const trails = [0, 1].map((index) => {
      const trail = effect('wala-touch-trail');
      trail.setAttribute('data-tail', String(index));
      return trail;
    });
    const press = {
      point, trails, identifier: touch.identifier,
      x: touch.clientX, y: touch.clientY,
      renderedX: touch.clientX, renderedY: touch.clientY,
      frame: 0, trailTimer: 0,
    };
    active = press;
    // El roce rápido deja actuar solo al kit; un gesto sostenido muestra el dedo.
    later(() => {
      if (active !== press) return;
      point.setAttribute('data-visible', 'true');
    }, 70);
  };
  const render = (press) => {
    press.frame = 0;
    if (active !== press) return;
    const dx = press.x - press.renderedX;
    const dy = press.y - press.renderedY;
    const distance = Math.hypot(dx, dy);
    press.point.style.left = `${press.x}px`;
    press.point.style.top = `${press.y}px`;
    press.renderedX = press.x;
    press.renderedY = press.y;
    if (distance < 3 || reducedMotion.matches || !press.point.hasAttribute('data-visible')) return;
    press.trails.forEach((trail, index) => {
      const offset = index === 0 ? 18 : 28;
      trail.style.left = `${press.x - (dx / distance) * offset}px`;
      trail.style.top = `${press.y - (dy / distance) * offset}px`;
      trail.setAttribute('data-visible', 'true');
    });
    view.clearTimeout(press.trailTimer);
    timers.delete(press.trailTimer);
    // Al detener el dedo se borra la estela, aunque siga apoyado.
    press.trailTimer = later(() => press.trails.forEach((trail) => trail.removeAttribute('data-visible')), 90);
  };
  const moved = (event) => {
    if (!active) return;
    if (event.touches.length !== 1) { cancel(); return; }
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === active.identifier);
    if (!touch) { cancel(); return; }
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
    const { point, trails } = press;
    trails.forEach((trail) => trail.removeAttribute('data-visible'));
    if (point.hasAttribute('data-visible')) {
      point.removeAttribute('data-visible');
      point.setAttribute('data-released', 'true');
      later(() => { remove(point); trails.forEach(remove); }, 180);
    } else {
      remove(point);
      trails.forEach(remove);
    }
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
