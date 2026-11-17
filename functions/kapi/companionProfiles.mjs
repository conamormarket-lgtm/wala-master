// Shared pure profile data. Keep the browser and Functions copies identical.
// Shared, data-only configuration: the server remains authoritative for routing
// and catalog scope. Browser requests cannot provide prompts or arbitrary roles.
export const ANIMATION_NAMES = ['idle', 'walk', 'wave', 'talk', 'think', 'point'];
const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function assetUrl(value) {
  const url = text(value, 1800);
  if (/^\/assets\/[\w/.-]+$/.test(url) && !url.includes('..')) return url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch { return ''; }
}
export function normalizeCompanionConfig(value, brand = {}) {
  const lumi = slug(brand.slug || brand.name || brand.nombre) === 'lumi';
  const source = value && typeof value === 'object' ? value : {};
  const animations = {};
  for (const name of ANIMATION_NAMES) {
    const item = source.animations?.[name];
    if (assetUrl(item?.src)) animations[name] = { src: assetUrl(item.src), still: assetUrl(item.still), duration: Math.max(300, Math.min(15000, Number(item.duration) || 2000)) };
  }
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : lumi,
    name: text(source.name, 60) || (lumi ? 'Lumita' : ''),
    specialty: text(source.specialty, 500) || (lumi ? 'Skincare, cuidado cosmético de la piel y asesoría de productos de Lumi.' : ''),
    instructions: text(source.instructions, 1500) || (lumi ? 'Ayuda a elegir una rutina sencilla según preferencias, productos que ya usa y presupuesto. Pregunta solo lo necesario. No presiones a comprar varios productos.' : ''),
    greeting: text(source.greeting, 200) || (lumi ? '¡Hola! Soy Lumita, la cuyita de Lumi. Mi especialidad es el skincare 😊' : ''),
    color: /^#[a-f0-9]{6}$/i.test(source.color) ? source.color : '#7741b2',
    assetPack: ['kapi', 'lumi', 'custom'].includes(source.assetPack) ? source.assetPack : lumi ? 'lumi' : 'custom',
    byTopic: source.byTopic !== false, byRoute: source.byRoute !== false,
    catalogScope: source.catalogScope === 'all' ? 'all' : 'brand',
    portrait: assetUrl(source.portrait), animations,
  };
}
export const KAPI_PROFILE = Object.freeze({ id: 'kapi', name: 'Kapi', brandId: null, brandName: 'Walá', route: '/', specialty: 'Anfitrión general de Walá: regalos, navegación, varias marcas y consultas generales de la tienda.', instructions: '', greeting: '¡Hola! Soy Kapi. Estoy aquí para ayudarte a explorar Walá.', color: '#7741b2', assetPack: 'kapi', byTopic: true, byRoute: true, catalogScope: 'all', portrait: '', animations: {} });
export function profilesFromBrands(brands = []) {
  const profiles = [KAPI_PROFILE];
  for (const brand of brands.slice(0, 100)) {
    if (!/^[\w-]{1,160}$/.test(brand.id || '')) continue;
    const config = normalizeCompanionConfig(brand.companion, brand);
    if (!config.enabled || !config.name || !config.specialty) continue;
    if (config.assetPack === 'custom' && (!config.portrait || !ANIMATION_NAMES.every(name => config.animations[name]?.src))) continue;
    profiles.push({ ...config, id: `brand_${brand.id}`, brandId: brand.id, brandName: text(brand.name, 80), route: '/' + slug(brand.slug || brand.name) });
  }
  return profiles;
}
export function publicProfile({ instructions, ...profile }) { return profile; }
export const profileForPath = (profiles, pathname) => profiles.find(p => p.id !== 'kapi' && p.byRoute && p.route === pathname) || profiles[0] || KAPI_PROFILE;
