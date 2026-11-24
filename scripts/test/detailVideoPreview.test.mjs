import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDetailVideo } from '../../src/utils/detailVideoPreview.mjs';

class Video extends EventTarget {
  paused = true;
  readyState = 0;
  duration = NaN;
  currentTime = 0;
  poster = '';
  error = null;
  seeking = false;
  frames = new Map();
  frameId = 0;
  plays = 0;
  loads = 0;
  ownerDocument = { visibilityState: 'visible', defaultView: { innerWidth: 1280, innerHeight: 720 } };
  rect = { width: 200, height: 300, top: 100, bottom: 400, left: 100, right: 300 };
  getBoundingClientRect() { return this.rect; }
  requestVideoFrameCallback(callback) { const id = ++this.frameId; this.frames.set(id, callback); return id; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  present() { const callbacks = [...this.frames.values()]; this.frames.clear(); callbacks.forEach(callback => callback()); }
  emit(name) { this.dispatchEvent(new Event(name)); }
  metadata() { this.readyState = 2; this.duration = 29.12; this.emit('loadedmetadata'); }
  play() {
    this.plays++;
    if (this.rejection) return Promise.reject(Object.assign(new Error(), { name: this.rejection }));
    this.paused = false;
    this.emit('play');
    this.emit('playing');
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  load() { this.loads++; this.error = null; }
}

function setup(t, options = {}, video = new Video()) {
  const states = [];
  const controller = prepareDetailVideo(video, { autoPlay: false, muted: false, onState: state => states.push(state), ...options });
  t.after(() => controller.dispose());
  return { video, controller, states };
}

test('prepara un fotograma sin poster, sin reproducir ni emitir audio; luego empieza desde cero', async t => {
  const { video, states } = setup(t);
  video.metadata();
  assert.equal(video.currentTime, 0.1);
  assert.equal(video.paused, true);
  assert.equal(video.plays, 0);
  assert.equal(states.at(-1), 'loading');
  video.present();
  assert.equal(states.at(-1), 'ready');
  await video.play();
  assert.equal(video.currentTime, 0);
  video.present();
  assert.equal(states.at(-1), 'ready');
});

test('un bloqueo de autoplay conserva el botón manual incluso después de obtener el fotograma', async t => {
  const video = new Video();
  video.rejection = 'NotAllowedError';
  const { controller, states } = setup(t, { autoPlay: true, muted: true }, video);
  await Promise.resolve();
  assert.equal(video.muted, true);
  assert.equal(video.defaultMuted, true);
  assert.equal(video.playsInline, true);
  video.metadata();
  video.present();
  assert.equal(states.at(-1), 'manual');
  video.rejection = null;
  controller.retry();
  video.present();
  assert.equal(states.at(-1), 'ready');
  assert.equal(video.paused, false);
});

test('si el reloj avanza sin presentar imagen solicita otro fotograma y recupera la reproducción', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { video, states } = setup(t, { autoPlay: true, muted: true });
  video.metadata();
  video.currentTime = 2;
  t.mock.timers.tick(2500);
  assert.equal(video.currentTime, 2.001);
  video.emit('playing'); // A seek can emit playing again; it must not reset the retry budget.
  video.present();
  t.mock.timers.tick(5000);
  assert.equal(states.at(-1), 'ready');
  assert.equal(video.paused, false);
});

test('la recuperación tiene límite y ofrece reintentar sin reiniciar en bucle', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { video, states } = setup(t, { autoPlay: true, muted: true });
  video.metadata();
  video.currentTime = 2;
  t.mock.timers.tick(2500);
  video.emit('playing');
  t.mock.timers.tick(2500);
  assert.equal(states.at(-1), 'retry');
  assert.equal(video.paused, true);
  assert.equal(video.plays, 1);
  assert.equal(video.frames.size, 0);
});

test('no acusa fallo por estar fuera de pantalla, en segundo plano o esperando datos', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { video, states } = setup(t, { autoPlay: true, muted: true });
  t.mock.timers.tick(2500);
  video.metadata();
  video.ownerDocument.visibilityState = 'hidden';
  t.mock.timers.tick(2500);
  video.ownerDocument.visibilityState = 'visible';
  video.rect.top = 800;
  t.mock.timers.tick(2500);
  assert.equal(video.paused, false);
  assert.equal(states.includes('retry'), false);
  video.rect.top = 100;
  video.present();
  assert.equal(states.at(-1), 'ready');
});

test('ampliar pausa el mosaico; cerrar puede reanudarlo y no quedan callbacks del reproductor anterior', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { video, controller, states } = setup(t, { autoPlay: true, muted: true });
  video.metadata();
  video.currentTime = 5;
  video.present();
  controller.dispose();
  const oldStates = states.length;
  const background = setup(t, { autoPlay: true, muted: true, enabled: false }, video);
  assert.equal(video.paused, true);
  assert.equal(video.currentTime, 5);
  video.present();
  assert.equal(background.states.at(-1), 'ready');
  background.controller.dispose();
  const resumed = setup(t, { autoPlay: true, muted: true }, video);
  video.present();
  t.mock.timers.tick(5000);
  assert.equal(resumed.states.at(-1), 'ready');
  assert.equal(video.paused, false);
  assert.equal(states.length, oldStates);
});

test('archivo fallido permite recargarlo y navegadores sin callback usan los datos cargados', t => {
  const video = new Video();
  video.requestVideoFrameCallback = undefined;
  const { controller, states } = setup(t, {}, video);
  video.metadata();
  video.emit('seeked');
  assert.equal(states.at(-1), 'ready');
  video.error = { code: 4 };
  video.emit('error');
  assert.equal(states.at(-1), 'error');
  controller.retry();
  assert.equal(video.loads, 1);
  assert.equal(states.at(-1), 'ready');
});

test('una promesa rechazada después de desmontar no modifica la vista nueva', async t => {
  const video = new Video();
  let reject;
  video.play = () => new Promise((resolve, fail) => { reject = fail; });
  const { controller, states } = setup(t, { autoPlay: true }, video);
  controller.dispose();
  const count = states.length;
  reject(Object.assign(new Error(), { name: 'NotAllowedError' }));
  await Promise.resolve();
  assert.equal(states.length, count);
  assert.equal(video.frames.size, 0);
});
