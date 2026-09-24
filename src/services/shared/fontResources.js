import googleFonts from './googleFonts.json';
import { localFontRules } from './fontFamilies.mjs';

let localCss;
const loadedGoogle = new Map();
export const isBundledGoogleFont = (family) => Boolean(googleFonts[family]);

export function installFontRule(family, rule) {
  const id = `wala-font-${encodeURIComponent(family)}`;
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  if (style.textContent !== rule) style.textContent = rule;
}

function googleStyles(family) {
  if (loadedGoogle.has(family)) return loadedGoogle.get(family);
  const promise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleFonts[family]}&display=swap`;
    link.onload = resolve;
    link.onerror = () => { loadedGoogle.delete(family); link.remove(); resolve(); };
    document.head.appendChild(link);
  });
  loadedGoogle.set(family, promise);
  return promise;
}

export async function loadFontResources(families = [], all = false) {
  if (typeof document === 'undefined') return;
  const names = all ? Object.keys(googleFonts) : families;
  const pending = names.filter(isBundledGoogleFont).map(googleStyles);
  if (all || families.some((family) => !isBundledGoogleFont(family))) {
    localCss ||= fetch('/fonts/fonts.css').then((res) => {
      if (!res.ok) throw new Error('Font stylesheet unavailable');
      return res.text();
    }).catch((error) => { localCss = null; throw error; });
    pending.push(localCss.then((css) => {
      localFontRules(css, families, all).forEach(({ family, rule }) => installFontRule(family, rule));
    }));
  }
  // Do not hold navigation forever if a font provider is unavailable.
  let timeout;
  try {
    await Promise.race([Promise.all(pending), new Promise((resolve) => { timeout = setTimeout(resolve, 3000); })]);
  } finally {
    clearTimeout(timeout);
  }
}

// Register font faces before the canvas mounts, as they were when the editor
// styles lived in index.html. Unavailable font providers must not trap navigation.
export function withEditorFonts(modulePromise) {
  return Promise.all([modulePromise, loadFontResources([], true).catch(() => {})])
    .then(([module]) => module);
}
