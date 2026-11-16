export const isKapiPublicRoute = pathname => ['/', '/home', '/tienda', '/personalizar', '/carrito'].includes(pathname)
  || /^\/producto\/[\w-]{1,160}$/.test(pathname);

export function isKapiPreview({ dev, hostname, pathname, search, enabled = false }) {
  const flag = new URLSearchParams(search).get('kapiDemo');
  return Boolean(dev && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    && (['/', '/home', '/tienda', '/personalizar', '/carrito', '/minijuegos'].includes(pathname)
      || /^\/(producto|crear|combo)\/[\w-]{1,160}$/.test(pathname))
    && (flag === '1' || (flag !== '0' && enabled)));
}

export const actorSize = width => width <= 768
  ? { width: 88, height: 118, image: 152, imageTop: -22 }
  : { width: 112, height: 150, image: 192, imageTop: -30 };

export const rectAt = (x, y, width, height) => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height });
export const intersects = (a, b, gap = 0) => Boolean(a && b
  && a.left < b.right + gap && a.right > b.left - gap
  && a.top < b.bottom + gap && a.bottom > b.top - gap);

const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
export function stageBounds(viewport, bottomInset = 16) {
  const left = (viewport.left || 0) + 12, top = (viewport.top || 0) + 12;
  return { left, top, right: left + viewport.width - 24, bottom: Math.max(top, (viewport.top || 0) + viewport.height - bottomInset) };
}

// Solve both bodies together: staying within the viewport alone is insufficient.
// If no unobstructed placement exists, omit the overlay rather than hide a target.
export function placeCompanion({ viewport, actor, bubble, preferred, target = null, avoid = [], bottomInset = 16, nearTarget = Boolean(target) }) {
  const bounds = stageBounds(viewport, bottomInset), gap = 16;
  const clampActor = point => ({ x: clamp(point.x, bounds.left, bounds.right - actor.width), y: clamp(point.y, bounds.top, bounds.bottom - actor.height) });
  const desired = clampActor(preferred || { x: bounds.right - actor.width, y: bounds.bottom - actor.height });
  const xs = [desired.x, bounds.left, bounds.right - actor.width];
  const ys = [desired.y, bounds.top, bounds.bottom - actor.height];
  if (target) {
    xs.push(target.left - actor.width - gap, target.right + gap, (target.left + target.right - actor.width) / 2);
    ys.push(target.top - actor.height - gap, target.bottom + gap, target.bottom - actor.height,
      (target.top + target.bottom) / 2 - actor.height * .4);
  }
  for (const rect of avoid) {
    xs.push(rect.left - actor.width - gap, rect.right + gap);
    ys.push(rect.top - actor.height - gap, rect.bottom + gap);
  }
  const blocksContent = rect => Boolean(target) && avoid.some(item => intersects(rect, item, 6));
  const proximity = body => {
    if (!target || !nearTarget) return 0;
    // Approximate the pointing hand, so side-by-side placement aligns the gesture
    // with the control. Wide headers can instead be explained from below.
    const x = (target.left + target.right) / 2 < (body.left + body.right) / 2 ? body.left : body.right;
    const y = body.top + actor.height * .4;
    return Math.hypot(x - clamp(x, target.left, target.right), y - clamp(y, target.top, target.bottom));
  };
  const obstruction = rect => avoid.reduce((total, item) => total
    + Math.max(0, Math.min(rect.right, item.right + 6) - Math.max(rect.left, item.left - 6))
    * Math.max(0, Math.min(rect.bottom, item.bottom + 6) - Math.max(rect.top, item.top - 6)), 0);
  const candidates = [];
  for (const x of new Set(xs)) for (const y of new Set(ys)) {
    const point = clampActor({ x, y });
    const body = rectAt(point.x, point.y, actor.width, actor.height);
    if (body.right > bounds.right || body.bottom > bounds.bottom || intersects(body, target, 12) || blocksContent(body)) continue;
    // During guidance proximity wins; previous position only breaks close ties.
    const distance = proximity(body) + Math.hypot(point.x - desired.x, point.y - desired.y) * (target && nearTarget ? .015 : 1)
      + (target ? 0 : obstruction(body) * 8);
    if (!bubble) { candidates.push({ actor: body, bubble: null, score: distance }); continue; }
    if (bubble.width > bounds.right - bounds.left || bubble.height > bounds.bottom - bounds.top) continue;
    const options = [
      [point.x + actor.width / 2 - bubble.width / 2, point.y - bubble.height - gap, 'bottom'],
      [point.x - bubble.width - gap, point.y + actor.height / 2 - bubble.height / 2, 'right'],
      [point.x + actor.width + gap, point.y + actor.height / 2 - bubble.height / 2, 'left'],
      [point.x + actor.width / 2 - bubble.width / 2, point.y + actor.height + gap, 'top'],
    ];
    options.forEach(([bx, by, side], index) => {
      const speech = rectAt(clamp(bx, bounds.left, bounds.right - bubble.width), clamp(by, bounds.top, bounds.bottom - bubble.height), bubble.width, bubble.height);
      // 12px also protects the balloon's tail (7px) and the target's outline.
      if (intersects(speech, target, 12) || intersects(speech, body, 8) || blocksContent(speech)) return;
      const horizontal = side === 'bottom' || side === 'top';
      const tail = horizontal ? clamp(point.x + actor.width / 2 - speech.left, 20, speech.width - 20)
        : clamp(point.y + actor.height / 2 - speech.top, 20, speech.height - 20);
      candidates.push({ actor: body, bubble: speech, side, tail, score: distance + (target ? 0 : obstruction(speech) * 8) + index * (target ? .5 : 8) });
    });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length) return candidates[0];
  if (bubble) return placeCompanion({ viewport, actor, bubble: null, preferred, target, avoid, bottomInset, nearTarget });
  return { actor: null, bubble: null };
}

// Orthogonal routes keep the walking character out of the protected rectangle.
export function walkingRoute(from, to, actor, target, bounds, avoid = []) {
  if (!target && !avoid.length) return [to];
  const obstacles = [...(target ? [{ rect: target, gap: 12 }] : []), ...avoid.map(rect => ({ rect, gap: 6 }))];
  const clear = (a, b) => {
    const swept = rectAt(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(a.x-b.x)+actor.width, Math.abs(a.y-b.y)+actor.height);
    return obstacles.every(item => !intersects(swept, item.rect, item.gap));
  };
  const options = [
    [{ x: to.x, y: from.y }, to], [{ x: from.x, y: to.y }, to],
    ...[bounds.left, bounds.right - actor.width, ...obstacles.flatMap(({rect}) => [rect.left - actor.width - 16, rect.right + 16])]
      .map(x => [{ x, y: from.y }, { x, y: to.y }, to]),
    ...[bounds.top, bounds.bottom - actor.height, ...obstacles.flatMap(({rect}) => [rect.top - actor.height - 16, rect.bottom + 16])]
      .map(y => [{ x: from.x, y }, { x: to.x, y }, to]),
  ];
  return options.map(points => {
    let previous = from, length = 0;
    for (const point of points) {
      if (point.x < bounds.left || point.y < bounds.top || point.x + actor.width > bounds.right || point.y + actor.height > bounds.bottom || !clear(previous,point)) return null;
      length += Math.hypot(point.x - previous.x,point.y - previous.y); previous = point;
    }
    return { points, length };
  }).filter(Boolean).sort((a,b) => a.length-b.length)[0]?.points ?? null;
}

export const GUIDES = [
  { id: 'search', label: 'Buscar', selectors: ['input[placeholder="Buscar productos, marcas y categorías"]', 'input[type="search"]'], text: 'Busca productos, marcas y categorías aquí.' },
  { id: 'store', label: 'Tienda', selectors: ['a[href="/tienda"]'], text: 'Explora el catálogo desde este acceso.' },
  { id: 'create', label: 'Crear', selectors: ['a[href="/personalizar"]'], text: 'Aquí puedes personalizar algo a tu estilo.' },
  { id: 'cart', label: 'Carrito', selectors: ['a[href="/carrito"]'], text: 'Revisa aquí lo que elegiste antes de continuar.' },
];

export function replyTo(input) {
  const text = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/carrito|comprar|pagar/.test(text)) return { target: 'cart' };
  if (/buscar|buscador|encontrar/.test(text)) return { target: 'search' };
  if (/crear|personaliz|disen/.test(text)) return { target: 'create' };
  if (/tienda|catalogo|producto/.test(text)) return { target: 'store' };
  if (/camina|ven aqui|muevete/.test(text)) return { move: true };
  if (/gracias|genial|bien hecho/.test(text)) return { animation: 'approve', text: '¡Con gusto! Aquí estaré si me necesitas.' };
  if (/hola|saluda/.test(text)) return { animation: 'wave', text: '¡Hola! Soy Kapi. ¿Damos una vuelta por Walá?' };
  if (/duerme|descansa/.test(text)) return { animation: 'sleep', text: 'Una siestita y vuelvo contigo.' };
  if (/celebra|aplaude/.test(text)) return { animation: 'clap', text: '¡Eso merece unas palmas!' };
  return { animation: 'confused', text: 'Todavía estoy aprendiendo. En esta prueba puedo mostrarte el buscador, la tienda, Crear y el carrito. También puedes pedirme que camine o salude.' };
}
