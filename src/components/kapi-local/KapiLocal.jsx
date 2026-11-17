import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { actorSize, placeCompanion, stageBounds, walkingRoute, GUIDES } from './model.mjs';
import { askKapi, localGesture } from './chatClient.mjs';
import { localProductPath, productIdFromPath, readConversation, saveConversation } from './session.mjs';
import { createScrollGate, sameViewport, scrollMovesTarget } from './scrollLayout.mjs';
import s from './KapiLocal.module.css';

const BASE = import.meta.env.DEV ? '/output/kapi-local' : '/assets/kapi/companion-v1';
const POINT_HOLD = BASE + '/assets/point-hold.png';
const INTRO = '¡Hola! Tócame para conversar.';
const money = amount => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
const viewportNow = () => ({
  width: window.visualViewport?.width || window.innerWidth,
  height: window.visualViewport?.height || window.innerHeight,
  left: window.visualViewport?.offsetLeft || 0,
  top: window.visualViewport?.offsetTop || 0,
});
const bottomSpace = viewport => viewport.width <= 768
  ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height')) || 56)
    + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0) + 18 : 18;
const homePoint = (viewport, x = Infinity) => {
  const size = actorSize(viewport.width), bounds = stageBounds(viewport, bottomSpace(viewport));
  return { x: x < viewport.width / 2 ? bounds.left : bounds.right - size.width, y: bounds.bottom - size.height };
};
const hintWidth = view => Math.min(224, view.width - actorSize(view.width).width - 40);
const readingAreas = view => {
  const root = document.getElementById('root');
  const clip = root && getComputedStyle(root).overflowY === 'auto' ? root.getBoundingClientRect() : null;
  if (clip) return [clip]; // Mobile product reader has a dedicated scroll region.
  const productReader = document.body.dataset.kapiProductReader === 'true' && document.getElementById('main-content-area');
  if (productReader) return [productReader.getBoundingClientRect()];
  const areas = [];
  for (const el of root?.querySelectorAll('h1, h2, h3, p, a, button, input, select, textarea, [role="button"], [data-kapi-important]') || []) {
    if (el.closest('[data-kapi-local]')) continue;
    const r = el.getBoundingClientRect();
    // Off-screen carousel slides are not obstacles. Stop reading layout after
    // enough visible content has been collected, rather than measuring it all.
    if (r.width > 0 && r.height > 0 && r.bottom > view.top && r.top < view.top + view.height
      && r.right > view.left && r.left < view.left + view.width) areas.push(r);
    if (areas.length === 64) break;
  }
  return areas;
};
const abortError = () => new DOMException('Cancelled', 'AbortError');
const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(abortError()); return; }
  const end = () => { signal.removeEventListener('abort', cancel); resolve(); };
  const timer = setTimeout(end, ms);
  const cancel = () => { clearTimeout(timer); reject(abortError()); };
  signal.addEventListener('abort', cancel, { once: true });
});

export default function KapiLocal() {
  const { pathname } = useLocation();
  const currentProductId = productIdFromPath(pathname);
  const [restored] = useState(() => { try { return readConversation(sessionStorage); } catch { return null; } });
  const previousPath = useRef(pathname);
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(restored?.mode || 'hint');
  const [controls, setControls] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [viewport, setViewport] = useState(viewportNow);
  const [position, setPosition] = useState(() => homePoint(viewportNow()));
  const [travel, setTravel] = useState(0);
  const [moving, setMoving] = useState(false);
  const [relocating, setRelocating] = useState(false);
  const [direction, setDirection] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [sprite, setSprite] = useState({ name: 'idle', src: BASE + '/assets/idle.png' });
  const [text, setText] = useState(restored?.mode === 'chat' ? restored.chatMessage : INTRO);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [products, setProducts] = useState(restored?.products || []);
  const [comparison, setComparison] = useState(restored?.comparison || null);
  const [userMessage, setUserMessage] = useState(restored?.userMessage || '');
  const [chatMessage, setChatMessage] = useState(restored?.chatMessage || '¡Hola! Cuéntame qué te gusta y cuánto quieres gastar. También puedo mostrarte la página.');
  const [assistantInfo, setAssistantInfo] = useState(null);
  const [picking, setPicking] = useState(false);
  const [tour, setTour] = useState(null);
  const [target, setTarget] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [guideScrolling, setGuideScrolling] = useState(false);
  const [layout, setLayout] = useState({ actor: null, bubble: null });
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const actor = useRef(null);
  const bubbleElement = useRef(null);
  const messageInput = useRef(null);
  const panelClose = useRef(null);
  const controlsTrigger = useRef(null);
  const operation = useRef(null);
  const chatRequest = useRef(null);
  const sessionId = useRef(restored?.sessionId || null);
  const sessionToken = useRef(restored?.sessionToken || null);
  const conversationBody = useRef(null);
  const blobs = useRef(new Map());
  const mounted = useRef(true);
  const point = useRef(position);
  const latest = useRef({});
  latest.current = { manifest, paused, reduced, viewport, speed, mode, moving, busy, target, controls, hidden, pending, animation: sprite.name };
  const size = actorSize(viewport.width);
  const bubbleWidth = mode !== 'chat' ? hintWidth(viewport)
    : currentProductId && viewport.width <= 768 && viewport.height >= 640
      ? Math.min(300, viewport.width - size.width - 40) : Math.min(300, viewport.width - 24);

  useEffect(() => {
    if (pending) return;
    try { saveConversation(sessionStorage, { sessionId: sessionId.current, sessionToken: sessionToken.current, chatMessage, userMessage, products, comparison, mode: mode === 'chat' ? 'chat' : 'none' }); } catch { /* storage optional */ }
  }, [chatMessage, userMessage, products, comparison, mode, pending]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch(`${BASE}/manifest.json`, { signal: controller.signal }).then(r => {
      if (!r.ok) throw Error('Manifest missing');
      return r.json();
    }).then(setManifest).catch(e => {
      if (e.name !== 'AbortError') setError('No pude cargar las animaciones. Recarga la página para intentarlo otra vez.');
    });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    fetch('/__kapi/health', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(setAssistantInfo).catch(() => {});
    return () => { mounted.current = false; controller.abort(); operation.current?.abort(); chatRequest.current?.abort(); media.removeEventListener('change', change); };
  }, []);

  // One cached encoded blob per animation; only the active image is decoded.
  const loadBlob = useCallback(async (name) => {
    const asset = latest.current.manifest?.[name];
    if (!asset) throw Error('Unknown animation');
    if (!blobs.current.has(name)) {
      const promise = fetch(asset.src).then(r => { if (!r.ok) throw Error('Asset missing'); return r.blob(); });
      blobs.current.set(name, promise);
      promise.catch(() => blobs.current.delete(name));
    }
    return blobs.current.get(name);
  }, []);

  useEffect(() => {
    if (!manifest) return;
    let alive = true;
    const heldPose = new Image();
    heldPose.src = manifest.point.hold || POINT_HOLD;
    // Sequential low-priority warming, not twenty simultaneous downloads.
    (async () => {
      for (const name of ['idle', 'walk', 'talk', 'wave', 'point']) {
        if (!alive) break;
        try { await loadBlob(name); } catch { /* On-demand retry remains available. */ }
      }
    })();
    return () => { alive = false; };
  }, [manifest, loadBlob]);

  useEffect(() => () => {
    if (sprite.src.startsWith('blob:')) URL.revokeObjectURL(sprite.src);
  }, [sprite.src]);

  const show = useCallback(async (name, signal) => {
    const animation = name === 'point-hold' ? 'point' : name;
    const asset = latest.current.manifest?.[animation];
    if (!asset) throw Error('Unknown animation');
    const still = name === 'point-hold' || latest.current.paused || latest.current.reduced;
    const holding = animation === 'point' && still;
    const blob = still ? null : await loadBlob(animation);
    if (signal.aborted || !mounted.current) throw abortError();
    // A fresh URL restarts each gesture at frame one without refetching it.
    const src = holding ? asset.hold || POINT_HOLD : still ? asset.still : URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = () => reject(Error('Image decode failed'));
      image.src = src;
    }).catch(e => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); throw e; });
    if (signal.aborted || !mounted.current) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); throw abortError(); }
    setSprite({ name: animation, src, phase: holding ? 'hold' : 'animation' });
  }, [loadBlob]);


  const moveTo = useCallback((next, duration = 0) => {
    point.current = next;
    setTravel(duration);
    setPosition(next);
  }, []);

  const freeze = useCallback(() => {
    const rect = actor.current?.getBoundingClientRect();
    const current = rect ? { x: rect.left, y: rect.top } : point.current;
    moveTo(current);
    return current;
  }, [moveTo]);

  const restingPose = useCallback(() => {
    const current = latest.current;
    if (current.pending && current.mode === 'chat') return 'think';
    return current.target?.isConnected && current.mode === 'hint' && !current.controls && !current.hidden ? 'point-hold' : 'idle';
  }, []);

  const run = useCallback((task, startsMoving = false, ending = 'idle') => {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    freeze(); setBusy(true); setMoving(startsMoving); setError(''); setPicking(false);
    (async () => {
      try {
        await task(controller.signal);
        if (!controller.signal.aborted && latest.current.manifest) await show(ending, controller.signal);
      } catch (e) {
        if (e.name !== 'AbortError' && mounted.current && !controller.signal.aborted) {
          setError('No pude cargar ese gesto. Inténtalo otra vez.');
          setSprite({ name: 'idle', src: BASE + '/assets/idle.png' });
        }
      } finally {
        if (mounted.current && operation.current === controller) {
          setBusy(false); setMoving(false); setRelocating(false);
        }
      }
    })();
  }, [freeze, show]);

  const play = useCallback(async (name, signal) => {
    await show(name, signal);
    await wait(latest.current.paused || latest.current.reduced ? 200 : latest.current.manifest[name].duration, signal);
  }, [show]);

  const walk = useCallback(async (destination, signal, obstacle = null) => {
    const from = freeze(), view = viewportNow(), body = actorSize(view.width);
    const bounds = stageBounds(view, bottomSpace(view));
    const avoid = obstacle ? readingAreas(view) : [];
    // The guide already solved the actor and bubble together. Keep that exact
    // destination when validating the walk, rather than optimizing a body alone.
    const placed = placeCompanion({ viewport: view, actor: body, preferred: destination, target: obstacle, avoid, nearTarget: false, bottomInset: bottomSpace(view) });
    if (!placed.actor) return;
    const to = { x: placed.actor.x, y: placed.actor.y };
    setMoving(true);
    if (latest.current.paused || latest.current.reduced) { moveTo(to); setMoving(false); return; }
    const route = walkingRoute(from, to, body, obstacle, bounds, avoid);
    // If scrolling put the character on the target already, quietly relocate
    // instead of animating it across the content being explained.
    if (!route) {
      setRelocating(true); moveTo(to); await wait(40, signal);
      setRelocating(false); setMoving(false); return;
    }
    await show('walk', signal);
    await wait(32, signal);
    let previous = from;
    for (const next of route) {
      const distance = Math.hypot(next.x - previous.x, next.y - previous.y);
      if (distance < 2) continue;
      if (Math.abs(next.x - previous.x) > 2) setDirection(next.x < previous.x ? -1 : 1);
      const duration = Math.max(100, distance / (170 * latest.current.speed) * 1000);
      moveTo(next, duration);
      await wait(duration, signal);
      previous = next;
    }
    setTravel(0); setMoving(false);
  }, [freeze, moveTo, show]);

  // Give a bottom-nav explanation room on small screens without covering the
  // brand cards above it. Restore the page as soon as the guide closes.
  useLayoutEffect(() => {
    if (target?.closest('[data-kapi-guide-nav]') && mode === 'hint' && !hidden) document.body.dataset.kapiNavGuide = 'true';
    else delete document.body.dataset.kapiNavGuide;
    return () => { delete document.body.dataset.kapiNavGuide; };
  }, [target, mode, hidden]);

  // Keep the companion anchored while browsing. Only a guide follows a page
  // target, and only after scrolling ends; the hot scroll path measures nothing.
  useLayoutEffect(() => {
    if (hidden) return;
    let frame, scrollGate;
    setGuideScrolling(false);
    const arrange = () => {
      if (scrollGate?.active) return;
      const view = viewportNow(), body = actorSize(view.width);
      const protectedRect = target?.isConnected ? target.getBoundingClientRect() : null;
      const visibleTarget = protectedRect && protectedRect.bottom > view.top && protectedRect.top < view.top + view.height;
      setHighlight(visibleTarget ? { left: protectedRect.left - 5, top: protectedRect.top - 5, width: protectedRect.width + 10, height: protectedRect.height + 10 } : null);
      if (latest.current.moving) return;
      const bubble = mode !== 'none' && !controls && bubbleElement.current
        ? { width: bubbleWidth, height: bubbleElement.current.getBoundingClientRect().height } : null;
      const next = placeCompanion({
        viewport: view, actor: body, bubble,
        preferred: point.current, target: visibleTarget ? protectedRect : null,
        avoid: mode === 'none' && !target ? [] : readingAreas(view), bottomInset: bottomSpace(view),
      });
      if (target && !visibleTarget) next.bubble = null;
      if (visibleTarget && next.actor) setDirection((protectedRect.left + protectedRect.right) / 2 < next.actor.x + body.width / 2 ? -1 : 1);
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      if (next.actor && (Math.abs(point.current.x - next.actor.x) > .1 || Math.abs(point.current.y - next.actor.y) > .1)) {
        moveTo({ x: next.actor.x, y: next.actor.y });
      }
    };
    const schedule = () => {
      if (scrollGate?.active) return;
      cancelAnimationFrame(frame); frame = requestAnimationFrame(arrange);
    };
    scrollGate = createScrollGate({ onStart: () => {
      cancelAnimationFrame(frame);
      setGuideScrolling(true);
    }, onEnd: () => {
      // Cancel a walk whose original destination moved, then place the held
      // pointing pose against the current target in the same render.
      if (latest.current.moving && latest.current.animation === 'walk') {
        operation.current?.abort(); freeze();
        latest.current.moving = false;
        setMoving(false); setBusy(false);
        setSprite({ name: 'point', src: latest.current.manifest?.point.hold || POINT_HOLD, phase: 'hold' });
      }
      frame = requestAnimationFrame(() => {
        arrange(); setGuideScrolling(false);
      });
    } });
    const onScroll = event => {
      // Ignore the conversation, controls and unrelated carousels. They do not
      // move the highlighted target, and must not move Kapi either.
      if (scrollMovesTarget(event.target, target, document, window)) scrollGate.scroll();
    };
    arrange();
    const observer = new ResizeObserver(schedule);
    if (bubbleElement.current) observer.observe(bubbleElement.current);
    if (target) observer.observe(target);
    if (currentProductId && mode === 'chat' && document.getElementById('root')) observer.observe(document.getElementById('root'));
    if (target) window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => { scrollGate.dispose(); observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll, true); };
  }, [viewport, mode, text, error, products, pending, target, tour, moving, hidden, controls, bubbleWidth, moveTo, freeze, pathname, currentProductId]);

  useEffect(() => { if (manifest) run(signal => play('wave', signal)); }, [manifest, run, play]);

  useEffect(() => {
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = viewportNow();
        if (sameViewport(latest.current.viewport, next)) return;
        setViewport(next);
        // Keyboard/rotation may interrupt a walk, but ordinary scroll must not
        // restart an animation or create/decode a fresh image URL.
        if (latest.current.moving) {
          run(async () => {}, false, restingPose());
        }
      });
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, [run, restingPose]);

  // Only unsolicited hints retire on their own; conversations and tours stay.
  useEffect(() => {
    if (mode !== 'hint' || target || tour !== null || busy || hovered || picking) return;
    const timer = setTimeout(() => setMode('none'), 7000);
    return () => clearTimeout(timer);
  }, [mode, target, tour, busy, hovered, picking, text]);

  useEffect(() => {
    if (mode === 'chat') messageInput.current?.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => { if (controls) panelClose.current?.focus({ preventScroll: true }); }, [controls]);
  const closeControls = useCallback(() => {
    setControls(false);
    requestAnimationFrame(() => controlsTrigger.current?.focus({ preventScroll: true }));
  }, []);

  const cancelChat = useCallback(() => {
    chatRequest.current?.abort(); chatRequest.current = null; setPending(false);
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    cancelChat(); setTarget(null); setTour(null); setControls(false);
    setMode(currentProductId ? 'hint' : 'none');
    setText(currentProductId ? '¡Aquí está! Puedo explicarte este producto. Tócame cuando quieras.' : chatMessage);
    run(async () => {});
  }, [pathname, currentProductId, cancelChat, run, chatMessage]);

  const dismiss = useCallback(() => {
    cancelChat();
    setMode('none'); setControls(false); setTarget(null); setTour(null); setPicking(false);
    // Close cancels the guide immediately, including an in-flight walk or decode.
    setSprite({ name: 'idle', src: BASE + '/assets/idle.png' });
    run(async () => {});
    actor.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [run, cancelChat]);

  useEffect(() => {
    const key = e => {
      if (e.key !== 'Escape') return;
      if (controls) closeControls();
      else dismiss();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [controls, closeControls, dismiss]);

  useEffect(() => {
    if (!picking) return;
    const choose = e => {
      if (e.target.closest('[data-kapi-local], button, a, input, select, textarea, [role="button"]')) return;
      setMode('none');
      run(signal => walk({ x: e.clientX - actorSize(window.innerWidth).width / 2, y: point.current.y }, signal), true);
    };
    document.addEventListener('pointerdown', choose);
    return () => document.removeEventListener('pointerdown', choose);
  }, [picking, run, walk]);

  useEffect(() => {
    if (manifest) run(async () => {}, false, restingPose());
  }, [paused, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        operation.current?.abort(); freeze(); setBusy(false); setMoving(false);
        setSprite(restingPose() === 'point-hold'
          ? { name: 'point', src: latest.current.manifest?.point.hold || POINT_HOLD, phase: 'hold' }
          : { name: 'idle', src: BASE + '/assets/idle.png' });
      } else if (latest.current.manifest) run(async () => {}, false, restingPose());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [freeze, run, restingPose]);

  const startWalk = destination => {
    cancelChat();
    setControls(false); setMode('none'); setTarget(null); setTour(null);
    run(signal => walk(destination, signal), true);
  };
  const gesture = name => {
    cancelChat();
    setControls(false); setTarget(null); setTour(null); setMode('hint');
    const phrases = { wave: '¡Hola! Qué gusto verte.', talk: 'Te escucho. Tócame para conversar.', think: 'Déjame pensar un momentito…', approve: '¡Me parece una buena idea!', disapprove: 'Quizá podemos probar otra opción.', confused: '¿Me lo cuentas de otra forma?', celebrate: '¡Lo logramos!', sleep: 'Una siestita y vuelvo.', wake: '¡Ya estoy de vuelta!', clap: '¡Un aplauso para ti!', laugh: 'Je, je… ¡me hiciste sonreír!' };
    setText(phrases[name] || 'Así puedo ' + manifest[name].label.toLowerCase() + '.');
    if (name === 'walk') startWalk(homePoint(viewportNow(), point.current.x > viewport.width / 2 ? 0 : Infinity));
    else run(signal => play(name, signal));
  };

  const guide = (id, index = null, explanation = null) => {
    cancelChat();
    const item = GUIDES.find(g => g.id === id);
    const elements = item.selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(el => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    const el = elements.find(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }) || elements[0];
    setMode('hint'); setControls(false); setTour(index);
    if (!el) {
      setTarget(null); setText('Ese acceso no está visible aquí.');
      run(signal => play('confused', signal)); return;
    }
    setTarget(el); setText(explanation || item.text);
    run(async signal => {
      el.scrollIntoView({ behavior: latest.current.reduced ? 'instant' : 'smooth', block: 'center' });
      await wait(latest.current.reduced ? 32 : 450, signal);
      const view = viewportNow(), body = actorSize(view.width), rect = el.getBoundingClientRect();
      const placement = placeCompanion({
        viewport: view, actor: body,
        bubble: { width: hintWidth(view), height: bubbleElement.current?.getBoundingClientRect().height || 100 },
        preferred: point.current, target: rect, avoid: readingAreas(view), bottomInset: bottomSpace(view),
      });
      if (!placement.actor) { setMoving(false); return; }
      await walk({ x: placement.actor.x, y: placement.actor.y }, signal, rect);
      setDirection(rect.left + rect.width / 2 < placement.actor.x + body.width / 2 ? -1 : 1);
      await show('point', signal);
      if (!latest.current.paused && !latest.current.reduced) {
        await wait(latest.current.manifest.point.holdAfter || 1120, signal);
      }
    }, true, 'point-hold');
  };

  const nextStep = () => {
    if (tour < GUIDES.length - 1) guide(GUIDES[tour + 1].id, tour + 1);
    else {
      setTour(null); setTarget(null); setText('¡Listo! Tócame cuando me necesites.');
      run(signal => play('approve', signal));
    }
  };
  const openChat = () => {
    if (mode === 'chat') { dismiss(); return; }
    setControls(false); setMode('chat'); setTarget(null); setTour(null);
    setText(chatMessage);
    run(signal => play('talk', signal));
  };
  const sendMessage = async (message, displayMessage = message) => {
    if (!message.trim() || !manifest || chatRequest.current) return;
    const local = localGesture(message);
    if (local) {
      setInput(''); setUserMessage(displayMessage); setProducts([]); setComparison(null);
      if (local.move) startWalk(homePoint(viewportNow(), point.current.x > viewport.width / 2 ? 0 : Infinity));
      else {
        setText(local.message); setChatMessage(local.message);
        run(signal => play(local.gesture, signal));
      }
      return;
    }
    const controller = new AbortController();
    chatRequest.current = controller;
    setInput(''); setPending(true); setProducts([]); setComparison(null); setError('');
    setMode('chat'); setControls(false); setTarget(null); setTour(null);
    setUserMessage(displayMessage); setText('Déjame pensar un momentito…');
    run(async () => {}, false, 'think');
    const timeout = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await askKapi({ message, sessionId: sessionId.current, sessionToken: sessionToken.current, currentProductId, signal: controller.signal });
      if (!mounted.current || chatRequest.current !== controller || controller.signal.aborted) return;
      sessionId.current = response.sessionId;
      sessionToken.current = response.sessionToken || null;
      chatRequest.current = null; setPending(false);
      setChatMessage(response.message); setText(response.message); setProducts(response.products);
      setComparison(response.comparison || null);
      setAssistantInfo(previous => ({ ...previous, ...response, configured: true }));
      if (response.guide) guide(response.guide, null, response.message);
      else run(signal => play(response.gesture, signal));
      if (conversationBody.current) conversationBody.current.scrollTop = 0;
    } catch (e) {
      if (!mounted.current || chatRequest.current !== controller) return;
      chatRequest.current = null; setPending(false);
      if (e.code === 'session_expired') { sessionId.current = null; sessionToken.current = null; }
      const message = e.name === 'AbortError' ? 'La consulta está tardando. ¿Lo intentamos otra vez?'
        : e.message || 'No pude conectarme. Puedes seguir usando mis guías.';
      setText(message); setChatMessage(message);
      run(signal => play('confused', signal));
    } finally { clearTimeout(timeout); }
  };
  useEffect(() => {
    if (!import.meta.env.DEV && currentProductId && mode === 'chat' && !hidden) document.body.dataset.kapiProductReader = 'true';
    else delete document.body.dataset.kapiProductReader;
    return () => { delete document.body.dataset.kapiProductReader; };
  }, [currentProductId, mode, hidden]);

  const send = e => { e.preventDefault(); sendMessage(input.trim()); };
  useEffect(() => {
    const explain = event => {
      if (event.detail?.id !== currentProductId) return;
      setHidden(false);
      sendMessage('Explícame este producto.');
    };
    window.addEventListener('wala:kapi-explain-product', explain);
    return () => window.removeEventListener('wala:kapi-explain-product', explain);
  });
  const resetChat = () => {
    cancelChat(); sessionId.current = null; sessionToken.current = null; setProducts([]); setComparison(null); setUserMessage(''); setError('');
    const message = 'Empecemos de nuevo. ¿Qué te gustaría encontrar?';
    setChatMessage(message); setText(message); run(async () => {});
  };
  const openControls = () => {
    cancelChat();
    setControls(true); setMode('none'); setTarget(null); setTour(null);
    run(async () => {});
  };

  if (hidden) return createPortal(<button className={s.restore} data-kapi-local onClick={() => {
    setHidden(false); setMode('hint'); setText(INTRO); moveTo(homePoint(viewportNow())); run(signal => play('wave', signal));
  }}>Mostrar a Kapi</button>, document.body);

  const bubbleVisible = Boolean(layout.bubble && !moving && !controls && mode !== 'none' && !guideScrolling);
  // Keep both rendered rectangles from the same layout while stationary;
  // async gesture completion must not briefly desynchronize them during scroll.
  const drawPoint = !moving && layout.actor ? layout.actor : position;
  return createPortal(<div className={s.layer} data-kapi-local data-kapi-product-chat={Boolean(currentProductId && mode === 'chat')}>
    {highlight && !guideScrolling && <div className={s.highlight} style={highlight} data-kapi-highlight aria-hidden="true" />}
    <div ref={actor} data-kapi-actor className={s.actor} style={{
      width: size.width, height: size.height,
      transform: 'translate3d(' + drawPoint.x + 'px,' + drawPoint.y + 'px,0)',
      transition: travel ? 'transform ' + travel + 'ms linear' : 'none',
      visibility: guideScrolling || relocating || (!layout.actor && !moving) ? 'hidden' : 'visible',
    }}>
      <button className={s.character} aria-label="Hablar con Kapi" aria-expanded={mode === 'chat'} onClick={openChat}>
        <img className={s.sprite} style={{ width: size.image, height: size.image, left: (size.width - size.image) / 2, top: size.imageTop, transform: 'scaleX(' + direction + ')' }} src={sprite.src} alt="" draggable="false" data-animation={sprite.name} data-pose-phase={sprite.phase || 'animation'} />
      </button>
    </div>
    {mode !== 'none' && <section ref={bubbleElement} className={[s.bubble, mode === 'hint' ? s.hint : s.chat, mode === 'chat' && viewport.height < 520 ? s.shortChat : ''].join(' ')}
      data-kapi-bubble-mode={mode} data-side={layout.side || 'bottom'}
      aria-label={mode === 'chat' ? 'Conversación con Kapi' : 'Mensaje de Kapi'}
      aria-hidden={!bubbleVisible} inert={!bubbleVisible ? '' : undefined}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false); }}
      style={{ width: bubbleWidth, left: layout.bubble?.left ?? 12, top: layout.bubble?.top ?? 12, visibility: bubbleVisible ? 'visible' : 'hidden', '--tail': (layout.tail || 24) + 'px', '--bubble-max-height': Math.max(80, viewport.height - bottomSpace(viewport) - size.height - 42) + 'px' }}>
      <div className={s.bubbleContent}>
        {mode === 'chat' ? <header className={s.heading}><strong>Kapi</strong><div className={s.chatHeaderActions}><button className={s.resetChat} onClick={resetChat} aria-label="Nueva conversación con Kapi">Nueva</button><button onClick={dismiss} aria-label="Cerrar conversación">×</button></div></header>
          : <button className={s.hintClose} onClick={dismiss} aria-label="Cerrar mensaje de Kapi">×</button>}
        <div ref={conversationBody} className={mode === 'chat' ? s.conversationBody : undefined} aria-busy={pending}>
        {mode === 'chat' && userMessage && <p className={s.userMessage}>{userMessage}</p>}
        <p className={s.message} role="status" aria-live="polite">{text}</p>
        {error && <p className={s.error} role="alert">{error}</p>}
        {mode === 'chat' && products.length > 0 && <div className={s.products} aria-label="Productos recomendados por Kapi">
          {comparison && <div className={s.comparisonSummary} aria-label="Resumen de la comparación">
            {comparison.budget != null && <p>Tu presupuesto: <strong>{money(comparison.budget)}</strong></p>}
            {comparison.priceGap != null && <p>{comparison.priceGap === 0 ? 'Estas opciones tienen el mismo precio.' : `Diferencia entre menor y mayor precio: ${money(comparison.priceGap)}.`}</p>}
          </div>}
          {products.filter(product => comparison || product.id !== currentProductId).map(product => {
            const row = comparison?.rows?.find(item => item.id === product.id);
            return <Link className={s.product} key={product.id} data-kapi-product-id={product.id} data-kapi-recommended={comparison?.recommendedId === product.id} data-kapi-comparison={Boolean(row)}
            to={import.meta.env.DEV ? localProductPath(product.id) : `/producto/${encodeURIComponent(product.id)}`}
            aria-label={`Ver detalles de ${product.name}`}>
            {product.image && <img src={product.image} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true; }} />}
            <div>{comparison?.recommendedId === product.id && <span className={s.recommendationBadge}>La elegiría para ti</span>}
              <strong>{product.name}</strong><span className={s.productPrice}>{product.price == null ? 'Precio por confirmar' : money(product.price)}</span>
              {product.stock === 'unknown' && <small>Disponibilidad por confirmar</small>}
              {product.stock === 'out' && <small>Agotado por ahora</small>}
              {!row && <span className={s.productAction}>Ver detalles →</span>}
            </div>
            {row && <div className={s.comparisonReason}><p>{row.advantage}</p><p><span>A considerar: </span>{row.limitation}</p>
              {row.overBudgetBy > 0 && <p className={s.overBudget}>Supera tu presupuesto en {money(row.overBudgetBy)}.</p>}
              <span className={s.productAction}>Ver detalles →</span>
            </div>}
          </Link>; })}
          <p className={s.catalogNote}>Datos del catálogo publicado. Consulta de solo lectura.</p>
        </div>}
        </div>
        {mode === 'hint' && tour !== null && <button className={s.next} onClick={nextStep}>{tour < GUIDES.length - 1 ? 'Siguiente' : 'Listo'} <span>{tour + 1}/{GUIDES.length}</span></button>}
        {mode === 'chat' && manifest && <>
          {products.length >= 2 && !comparison && <div className={s.choices}><button disabled={pending} onClick={() => sendMessage('Compara los productos que me recomendaste y dime cuál conviene más según mi presupuesto y lo que busco.', '¿Cuál de estas opciones me conviene más?')}>Comparar opciones</button></div>}
          {currentProductId && !comparison && <div className={s.choices}><button disabled={pending} onClick={() => sendMessage('Explícame este producto.')}>Explícame este producto</button></div>}
          {!userMessage && <div className={s.choices}><button onClick={() => sendMessage('Ayúdame a elegir un regalo.')}>Buscar un regalo</button><button onClick={() => guide(GUIDES[0].id, 0)}>Muéstrame la página</button></div>}
          {!currentProductId && !products.length && !pending && <div className={s.links}>{GUIDES.map(item => <button key={item.id} onClick={() => guide(item.id)}>{item.label}</button>)}</div>}
          <form className={s.form} onSubmit={send}><input ref={messageInput} aria-label="Mensaje para Kapi" placeholder={pending ? 'Kapi está pensando…' : 'Escríbele a Kapi…'} maxLength={1000} value={input} onChange={e => setInput(e.target.value)} /><button type="submit" disabled={pending || !input.trim()} aria-label="Enviar mensaje a Kapi">{pending ? '…' : '↑'}</button></form>
        </>}
      </div>
    </section>}
    {target && !moving && !layout.actor && <button className={s.restore} onClick={dismiss}>Cerrar guía de Kapi</button>}
    {!target && !controls && <button ref={controlsTrigger} className={s.controlsTrigger} style={position.x < viewport.width / 2 ? { left: 'auto', right: 12 } : undefined} aria-label="Abrir controles de Kapi" onClick={openControls}>⚙ <span>Controles de Kapi</span></button>}
    {controls && <aside className={s.panel} data-kapi-panel role="dialog" aria-label="Controles de Kapi" style={{ maxHeight: Math.max(130,viewport.height - bottomSpace(viewport) - 80) }}>
      <header className={s.heading}><div><strong>Controles de Kapi</strong>{import.meta.env.DEV && <small>Prueba local</small>}</div><button ref={panelClose} aria-label="Cerrar controles de Kapi" onClick={closeControls}>×</button></header>
      <div className={s.panelContent}>
        <div className={s.motionControls}>
          <button aria-label="Caminar a la izquierda" onClick={() => startWalk({ x: point.current.x - 220, y: point.current.y })}>←</button>
          <button aria-label="Caminar a la derecha" onClick={() => startWalk({ x: point.current.x + 220, y: point.current.y })}>→</button>
          <button aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Reanudar' : 'Pausar'}</button>
          <select aria-label="Velocidad al caminar" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="0.7">Lento</option><option value="1">Normal</option><option value="1.4">Rápido</option></select>
        </div>
        <div className={s.panelActions}><button onClick={() => { setControls(false); setMode('hint'); setTarget(null); setTour(null); setText('Haz clic en un espacio libre para llamarme.'); setPicking(true); }}>Llamar a Kapi</button><button onClick={() => { operation.current?.abort(); setControls(false); setHidden(true); }}>Ocultar a Kapi</button></div>
        {reduced && <p>Movimiento reducido según tu dispositivo.</p>}
        {import.meta.env.DEV && <h3>Probar un gesto</h3>}
        {import.meta.env.DEV && <div className={s.grid}>{Object.entries(manifest || {}).map(([name,item]) => <button key={name} aria-pressed={sprite.name === name} onClick={() => gesture(name)}>{item.label}</button>)}</div>}
        {import.meta.env.DEV && <p className={s.note}>{assistantInfo?.configured ? `${assistantInfo.provider === 'Local' ? 'Respuesta local' : `OpenAI · ${assistantInfo.model}`}. Catálogo publicado en modo de solo lectura.` : 'La conexión con IA aún no está disponible. Las guías y los gestos siguen activos.'}</p>}
        {import.meta.env.DEV && assistantInfo?.usage && <p className={s.note}>Última consulta: {assistantInfo.usage.inputTokens} tokens de entrada y {assistantInfo.usage.outputTokens} de salida.</p>}
        {import.meta.env.DEV && assistantInfo?.usage?.embeddingTokens > 0 && <p className={s.note}>Búsqueda semántica: {assistantInfo.usage.embeddingTokens} tokens de embeddings.</p>}
      </div>
    </aside>}
  </div>, document.body);
}
