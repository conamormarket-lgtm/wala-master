import { assetUrl, KAPI_PROFILE, profileForPath } from './companionProfiles.mjs';
export { KAPI_PROFILE, profileForPath };
const cache = new Map();
const labels = { idle: 'Reposo', walk: 'Caminar', wave: 'Saludar', talk: 'Hablar', think: 'Pensar', point: 'Señalar' };
const aliases = { approve: 'wave', disapprove: 'think', confused: 'think', laugh: 'talk', yes: 'talk', no: 'think', clap: 'wave', celebrate: 'wave', sleep: 'idle', wake: 'wave', sit: 'idle', sad: 'think', surprised: 'think', angry: 'think' };
export async function loadCompanionAnimations(profile) {
  const key = JSON.stringify([profile.assetPack, profile.portrait, profile.animations]);
  if (!cache.has(key)) cache.set(key, (async () => {
    const manifest = profile.assetPack === 'custom' ? profile.animations : await fetch(profile.assetPack === 'lumi'
      ? '/assets/companions/lumi-v1/manifest.json' : '/assets/kapi/companion-v1/manifest.json').then(r => { if (!r.ok) throw Error('Mascot assets unavailable'); return r.json(); });
    const entries = {};
    for (const [name, item] of Object.entries(manifest)) {
      if (!assetUrl(item.src)) continue;
      entries[name] = { ...item, label: item.label || labels[name] || name, src: assetUrl(item.src), still: assetUrl(item.still) || profile.portrait || assetUrl(manifest.idle?.still), duration: Math.max(300, Math.min(15000, Number(item.duration) || 2000)) };
    }
    if (!['idle','walk','wave','talk','think','point'].every(name => entries[name]?.src && entries[name]?.still)) throw Error('Incomplete mascot animations');
    for (const [name, fallback] of Object.entries(aliases)) entries[name] ||= entries[fallback];
    entries.point = { ...entries.point, hold: assetUrl(entries.point.hold) || entries.point.still, holdAfter: entries.point.holdAfter || 700 };
    // Decode the first frame before the outgoing mascot leaves.
    await new Promise((resolve,reject) => { const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = entries.idle.still; });
    return entries;
  })().catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
}
