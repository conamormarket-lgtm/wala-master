/**
 * Convierte un enlace de Google Drive (compartir) a URL directa de imagen para usar en <img src="...">.
 * Ej: https://drive.google.com/file/d/ABC123/view -> https://drive.google.com/uc?export=view&id=ABC123
 * @param {string} url - URL pegada por el admin (Drive, Imgur, o directa)
 * @returns {string} URL lista para usar como src de imagen
 */
export function toDirectImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';

  const id = getDriveFileId(u);
  if (id) return `https://drive.google.com/uc?export=view&id=${id}`;

  return u;
}

/**
 * Extrae el ID de archivo de una URL de Google Drive (si aplica).
 * @param {string} url
 * @returns {string|null}
 */
export function getDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  const m = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
    || u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
    || u.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * URL para vista previa de imagen. Para Drive usa el endpoint thumbnail (suele cargar mejor en iframe/img).
 * @param {string} url - URL pegada (Drive, Imgur, etc.)
 * @returns {string}
 */
export function getPreviewImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';

  const driveId = getDriveFileId(u);
  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;

  return u;
}
