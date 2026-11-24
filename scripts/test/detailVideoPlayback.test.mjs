import test from 'node:test';
import assert from 'node:assert/strict';
import { detailVideoPlayback, pauseCompetingDetailVideos } from '../../src/utils/detailVideoPlayback.mjs';
import { normalizeDetailComposition, validateDetailComposition } from '../../src/utils/productDetails.mjs';

const composition = media => ({ version: 1, blocks: [{ id: 'm', kind: 'mosaic', mosaicLayout: 'flexible', media }] });
const video = { id: 'v', type: 'video', url: 'https://example.test/video.mp4' };

test('vídeos anteriores mantienen reproducción manual y cada archivo conserva sus opciones al guardar', () => {
  const source = composition([video, { ...video, id: 'automatic', autoPlay: true, muted: false, loop: true }, { ...video, id: 'silent', muted: true }]);
  const stored = normalizeDetailComposition(source);
  assert.deepEqual(stored.blocks[0].media.map(detailVideoPlayback), [
    { autoPlay: false, muted: false, loop: false },
    { autoPlay: true, muted: true, loop: true },
    { autoPlay: false, muted: true, loop: false },
  ]);
  assert.equal(validateDetailComposition(stored), null);
  assert.deepEqual(normalizeDetailComposition(JSON.parse(JSON.stringify(stored))), stored);
  stored.blocks[0].media.reverse();
  Object.assign(stored.blocks[0].media[1], { autoPlay: false, muted: false, loop: false });
  assert.deepEqual(detailVideoPlayback(normalizeDetailComposition(stored).blocks[0].media[1]), { autoPlay: false, muted: false, loop: false });
});

test('rechaza opciones de reproducción ambiguas y no activa booleanos a partir de texto', () => {
  for (const field of ['autoPlay', 'muted', 'loop']) {
    const invalid = composition([{ ...video, [field]: 'true' }]);
    assert.match(validateDetailComposition(invalid), /reproducción/);
    assert.equal(normalizeDetailComposition(invalid).blocks[0].media[0][field], false);
  }
});

test('varios clips automáticos silenciosos coexisten; los vídeos manuales no se interrumpen con ellos', () => {
  const clips = [
    { autoplay: true, muted: true }, { autoplay: true, muted: true },
    { autoplay: false, muted: false }, { autoplay: false, muted: false },
  ].map(flags => ({ ...flags, pauses: 0, pause() { this.pauses++; }, closest: () => ({ querySelectorAll: () => clips }) }));
  pauseCompetingDetailVideos(clips[0]);
  assert.deepEqual(clips.map(v => v.pauses), [0, 0, 0, 0]);
  pauseCompetingDetailVideos(clips[2]);
  assert.deepEqual(clips.map(v => v.pauses), [0, 0, 0, 1]);
});
