/** Publish the reviewed Cónsul content only. Dry-run by default; --apply uploads
 * assets, verifies their public URLs, then updates one document conditionally.
 * Uses the existing Firebase CLI login, never stores credentials in the report.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { CONSUL_PRODUCT_ID, consulLocalProduct } from '../src/componentes/demo/consulLanding.mjs';
import { normalizeDetailComposition, validateDetailComposition } from '../src/utils/productDetails.mjs';
import { normalizeProductVideos } from '../src/utils/productVideos.mjs';

const require = createRequire(import.meta.url);
const project = 'sistema-gestion-3b225';
const bucket = `${project}.firebasestorage.app`;
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/product-media/consul-release');
const documentUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/productos_wala/${CONSUL_PRODUCT_ID}`;

export function decode(value) {
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k, decode(v)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('nullValue' in value) return null;
  return Object.values(value)[0];
}
export function encode(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k, encode(v)])) } };
}
export function mapMedia(value, urls) {
  if (typeof value === 'string') return urls[value] || value;
  if (Array.isArray(value)) return value.map(v => mapMedia(v, urls));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, mapMedia(v, urls)]));
  return value;
}
export function publicationPatch(source) {
  const proposal = consulLocalProduct(source);
  if (source.variants.length !== proposal.variants.length || proposal.variants.some(v => !v.id)) throw Error('Las variantes han cambiado; revisa el producto antes de publicar.');
  // Explicit allowlist: never write price, inventory, fulfillment or template settings.
  return Object.fromEntries(['images', 'mainImage', 'description', 'variants', 'videos', 'detailComposition'].map(key => [key, proposal[key]]));
}

async function main() {
  const apply = process.argv.includes('--apply');
  let auth;
  try { auth = require('firebase-tools/lib/auth.js'); }
  catch { auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js')); }
  const account = auth.getProjectDefaultAccount(root);
  if (!account) throw Error('Inicia sesión en Firebase CLI antes de continuar.');
  const tokens = await auth.getAccessToken(account.tokens.refresh_token, []);
  const authorized = (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${tokens.access_token}` } });
  const originalResponse = await authorized(documentUrl);
  if (!originalResponse.ok) throw Error(`Lectura del producto: HTTP ${originalResponse.status}`);
  const original = await originalResponse.json();
  const source = decode({ mapValue: { fields: original.fields } });
  const patch = publicationPatch(source);
  const localUrls = [...new Set(JSON.stringify(patch).match(/\/output\/product-media\/consul\/[\w/.-]+\.(?:webp|mp4)/g))];
  const files = await Promise.all(localUrls.map(async url => {
    const file = path.resolve(root, '.' + url);
    if (!file.startsWith(path.resolve(root, 'output/product-media/consul') + path.sep)) throw Error('Archivo fuera de la carpeta multimedia.');
    const data = await fs.readFile(file);
    const sha = createHash('sha256').update(data).digest('hex');
    return { url, file, sha, bytes: data.length, name: `products/${CONSUL_PRODUCT_ID}/landing/${sha.slice(0,16)}/${path.basename(file)}` };
  }));
  await fs.mkdir(output, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(output, `backup-${stamp}.json`), JSON.stringify(original, null, 2));
  await fs.writeFile(path.join(output, 'proposed-patch.json'), JSON.stringify(patch, null, 2));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', product: CONSUL_PRODUCT_ID, name: source.name, updateTime: original.updateTime, fields: Object.keys(patch), assets: files.length, megabytes: +(files.reduce((n,f) => n + f.bytes, 0) / 1024 ** 2).toFixed(2), variants: source.variants.map(v => ({ id: v.id, name: v.name })), price: source.price, stock: source.inStock }));
  if (!apply) return;
  const manifestPath = path.join(output, 'uploaded-assets.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '{}'));
  for (const [index, file] of files.entries()) {
    if (!manifest[file.sha]) {
      const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(file.name)}`;
      const existing = await authorized(metadataUrl);
      let metadata;
      if (existing.ok) metadata = await existing.json();
      else if (existing.status === 404) {
        const token = randomUUID();
        const boundary = `consul-${randomUUID()}`;
        const contentType = file.name.endsWith('.mp4') ? 'video/mp4' : 'image/webp';
        const details = { name: file.name, contentType, cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } };
        const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(details)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`), await fs.readFile(file.file), Buffer.from(`\r\n--${boundary}--\r\n`)]);
        const response = await authorized(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
        if (!response.ok) throw Error(`Subida ${index + 1}: HTTP ${response.status}`);
        metadata = await response.json();
      } else throw Error(`Storage: HTTP ${existing.status}`);
      const downloadToken = metadata.metadata?.firebaseStorageDownloadTokens?.split(',')[0];
      if (!downloadToken) throw Error('El archivo no tiene URL de descarga; no se publicará el producto.');
      manifest[file.sha] = { name: file.name, url: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(file.name)}?alt=media&token=${downloadToken}` };
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }
    const check = await fetch(manifest[file.sha].url, { method: 'HEAD' });
    if (!check.ok || Number(check.headers.get('content-length')) !== file.bytes) throw Error(`No se pudo verificar el archivo ${index + 1}; el producto no se modificó.`);
    console.log(`Medio ${index + 1}/${files.length} verificado`);
  }
  const urls = Object.fromEntries(files.map(f => [f.url, manifest[f.sha].url]));
  const ready = mapMedia(patch, urls);
  const invalid = validateDetailComposition(ready.detailComposition);
  if (invalid) throw Error(invalid);
  ready.detailComposition = normalizeDetailComposition(ready.detailComposition);
  ready.videos = normalizeProductVideos(ready.videos);
  if (ready.videos.length !== 5 || /\/output\/|local:|blob:/.test(JSON.stringify(ready))) throw Error('Quedan medios locales o vídeos inválidos.');
  // Preserve original Firestore field types inside variants, even for unknown future fields.
  const fields = encode(ready).mapValue.fields;
  fields.variants.arrayValue.values = ready.variants.map(v => {
    const originalVariant = original.fields.variants.arrayValue.values.find(x => x.mapValue.fields.id.stringValue === v.id);
    return { mapValue: { fields: { ...originalVariant.mapValue.fields, ...encode({ imageUrl: v.imageUrl, images: v.images, galleryImages: v.galleryImages }).mapValue.fields } } };
  });
  const query = new URLSearchParams({ 'currentDocument.updateTime': original.updateTime });
  Object.keys(fields).forEach(k => query.append('updateMask.fieldPaths', k));
  await fs.writeFile(path.join(output, 'published-patch.json'), JSON.stringify(ready, null, 2));
  const response = await authorized(`${documentUrl}?${query}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!response.ok) throw Error(`No se guardó el producto: HTTP ${response.status}. Si hubo una edición concurrente, vuelve a revisar antes de reintentar.`);
  const result = await response.json();
  await fs.writeFile(path.join(output, 'published-document.json'), JSON.stringify(result, null, 2));
  const verification = await authorized(documentUrl);
  if (!verification.ok) throw Error(`No se pudo verificar el producto: HTTP ${verification.status}`);
  const after = await verification.json();
  for (const [key, value] of Object.entries(fields)) {
    if (!isDeepStrictEqual(after.fields[key], value)) throw Error(`El campo publicado no coincide: ${key}`);
  }
  for (const [key, value] of Object.entries(original.fields)) {
    if (!Object.hasOwn(fields, key) && !isDeepStrictEqual(after.fields[key], value)) throw Error(`Revisar campo no editado: ${key}`);
  }
  console.log(JSON.stringify({ published: CONSUL_PRODUCT_ID, updateTime: after.updateTime, assetsVerified: files.length, backup: `backup-${stamp}.json` }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
