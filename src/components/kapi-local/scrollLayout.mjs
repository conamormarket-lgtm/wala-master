// Page scrolling must never run the placement solver per frame. A guide pauses
// once, then measures its target once the relevant scroll container settles.
export function createScrollGate({ onStart, onEnd, delay = 180, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer, active = false;
  return {
    get active() { return active; },
    scroll() {
      clearTimer(timer);
      if (!active) { active = true; onStart(); }
      timer = setTimer(() => { active = false; onEnd(); }, delay);
    },
    dispose() { clearTimer(timer); active = false; },
  };
}

export const sameViewport = (a, b) => ['width', 'height', 'left', 'top']
  .every(key => Math.abs((a[key] || 0) - (b[key] || 0)) < .5);

export function scrollMovesTarget(source, target, document, window) {
  return Boolean(target && (source === document || source === window || source?.contains?.(target)));
}
