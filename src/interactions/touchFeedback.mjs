// Capa táctil para Android y la web móvil, sin editar los componentes del kit.
const TARGETS = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [data-wala-touch-target]';
const EXCLUDED = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], canvas, [draggable="true"], [data-componente="LienzoPrenda"], [data-componente="CajaVarias"], [data-wala-touch-feedback="off"]';
const NOOP = () => {};
let captureConfirmation = () => NOOP;
let uninstall;

/** Capturar al iniciar una acción y llamar SOLO cuando se confirme. */
export function captureTouchConfirmation() {
  return captureConfirmation();
}

export function installTouchFeedback(view = window) {
  if (uninstall) return uninstall;

  const doc = view.document;
  const root = doc.documentElement;
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = view.matchMedia('(pointer: coarse)');
  const nativeAndroid = view.Capacitor?.getPlatform?.() === 'android' && Boolean(view.Capacitor?.isNativePlatform?.());
  const timers = new Set();
  const effects = new Set();
  let active = null;
  let lastPress = null;
  let disposed = false;
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
  const borderRadius = (target) => {
    // El enlace de una foto llena un marco que es quien tiene las esquinas.
    let candidate = target;
    const bounds = target.getBoundingClientRect();
    for (let i = 0; candidate && i < 3; i += 1, candidate = candidate.parentElement) {
      const rect = candidate.getBoundingClientRect();
      if (Math.abs(rect.width - bounds.width) > 4 || Math.abs(rect.height - bounds.height) > 4) break;
      const radius = view.getComputedStyle(candidate).borderRadius;
      if (radius !== '0px') return radius;
    }
    return '12px';
  };
  const cancel = () => {
    if (lastPress) {
      lastPress.cancelled = true;
      remove(lastPress.halo);
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
  const down = (event) => {
    cancel();
    lastInputTouch = event.pointerType === 'touch';
    if (!lastInputTouch) { syncMode(); return; }
    // También funciona al activar la emulación móvil sin recargar la página.
    root.setAttribute('data-wala-touch', nativeAndroid ? 'android' : 'touch');
    if (!event.isPrimary) return;
    const target = targetFor(event.target);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const halo = effect('wala-touch-halo');
    Object.assign(halo.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      borderRadius: borderRadius(target),
    });
    halo.style.setProperty('--wala-touch-x', `${event.clientX - rect.left}px`);
    halo.style.setProperty('--wala-touch-y', `${event.clientY - rect.top}px`);
    active = {
      target, halo, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, cancelled: false, releasedAt: 0,
      url: view.location.href,
    };
    lastPress = active;
  };
  const moved = (event) => {
    if (active?.pointerId === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) cancel();
  };
  const up = (event) => {
    if (!active || active.pointerId !== event.pointerId) return;
    moved(event);
    if (!active) return;
    const { target, halo } = active;
    const underFinger = doc.elementFromPoint(event.clientX, event.clientY);
    if (!target.isConnected || !underFinger || !target.contains(underFinger)) { cancel(); return; }
    active.releasedAt = view.performance.now();
    halo.setAttribute('data-released', 'true');
    later(() => remove(halo), 180);
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
  const sparkle = (press) => {
    if (disposed || press.cancelled || reducedMotion.matches || !press.target.isConnected || press.url !== view.location.href) return;
    const rect = press.target.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= view.innerHeight || rect.right <= 0 || rect.left >= view.innerWidth) return;
    const star = effect('wala-touch-spark');
    // Dentro del control: también se ve en los botones pegados al borde.
    star.style.left = `${Math.min(view.innerWidth - 12, Math.max(12, rect.right - 12))}px`;
    star.style.top = `${Math.max(12, Math.min(view.innerHeight - 12, rect.top + 12))}px`;
    later(() => remove(star), 340);
  };
  captureConfirmation = () => {
    const press = lastPress;
    if (!press || press.cancelled || !press.releasedAt || view.performance.now() - press.releasedAt > 700) return NOOP;
    return () => {
      // Agregar varios productos desde un mismo botón produce un solo destello.
      if (press.confirmed) return;
      press.confirmed = true;
      // Una respuesta de red tardía no debe animar otra pantalla.
      if (view.performance.now() - press.releasedAt < 8000) sparkle(press);
    };
  };
  const hidden = () => { if (doc.hidden) cancel(); };
  const keyboard = () => { lastInputTouch = false; cancel(); };
  const listeners = [
    [doc, 'pointerdown', down, { capture: true, passive: true }],
    [doc, 'pointermove', moved, { capture: true, passive: true }],
    [doc, 'pointerup', up, { capture: true, passive: true }],
    [doc, 'pointercancel', cancel, { capture: true, passive: true }],
    [doc, 'scroll', cancel, { capture: true, passive: true }],
    [doc, 'contextmenu', contextMenu, { capture: true }],
    [doc, 'dragstart', drag, { capture: true }],
    [doc, 'visibilitychange', hidden, false],
    [doc, 'keydown', keyboard, { capture: true, passive: true }],
    [coarsePointer, 'change', syncMode, false],
    [view, 'blur', cancel, false],
    [view, 'resize', cancel, { passive: true }],
  ];
  listeners.forEach(([owner, name, handler, options]) => owner.addEventListener(name, handler, options));
  uninstall = () => {
    disposed = true;
    cancel();
    listeners.forEach(([owner, name, handler, options]) => owner.removeEventListener(name, handler, options));
    timers.forEach((id) => view.clearTimeout(id));
    effects.forEach((node) => node.remove());
    root.removeAttribute('data-wala-touch');
    captureConfirmation = () => NOOP;
    uninstall = undefined;
  };
  return uninstall;
}
