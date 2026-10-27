const encoder = new TextEncoder();
const firma = [137, 80, 78, 71, 13, 10, 26, 10];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Canvas exporta a 96 ppp. pHYs registra los 300 ppp reales del archivo de impresión. */
export async function establecerPppPng(blob, ppp = 300) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!firma.every((b, i) => bytes[i] === b)) throw new Error('El archivo no es un PNG válido.');
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set(encoder.encode('pHYs'), 4);
  const porMetro = Math.round(ppp / .0254);
  view.setUint32(8, porMetro); view.setUint32(12, porMetro); chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  const partes = [bytes.subarray(0, 8)];
  let pos = 8, insertado = false;
  while (pos + 12 <= bytes.length) {
    const largo = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0);
    const fin = pos + 12 + largo;
    if (fin > bytes.length) throw new Error('El PNG está incompleto.');
    const tipo = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (tipo === 'IDAT' && !insertado) { partes.push(chunk); insertado = true; }
    if (tipo !== 'pHYs') partes.push(bytes.subarray(pos, fin));
    pos = fin;
  }
  if (!insertado || pos !== bytes.length) throw new Error('El PNG está incompleto.');
  return new Blob(partes, { type: 'image/png' });
}
