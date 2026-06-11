/**
 * Hace transparente un color (y colores similares) en una imagen.
 * @param {string|HTMLImageElement} imageSource - URL de la imagen o elemento <img> ya cargado
 * @param {string} colorHex - Color a eliminar en hex (ej. '#FFFFFF' o 'FFF')
 * @param {number} tolerancePercent - 0-100: tolerancia por canal (mayor = más tonos similares se quitan)
 * @param {number} maxWidth - Ancho máximo para procesar (evita imágenes gigantes); 0 = sin límite
 * @returns {Promise<string>} Data URL PNG de la imagen con el fondo transparente
 */
export function makeColorTransparent(imageSource, colorHex, tolerancePercent = 20, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const img = typeof imageSource === 'string' ? new Image() : null;
    const useElement = typeof imageSource !== 'string';

    const run = (imageElement) => {
      const w = imageElement.naturalWidth || imageElement.width;
      const h = imageElement.naturalHeight || imageElement.height;
      if (!w || !h) {
        reject(new Error('No se pudieron leer las dimensiones de la imagen'));
        return;
      }

      let drawW = w;
      let drawH = h;
      if (maxWidth > 0 && w > maxWidth) {
        drawW = maxWidth;
        drawH = Math.round((h * maxWidth) / w);
      }

      const canvas = document.createElement('canvas');
      canvas.width = drawW;
      canvas.height = drawH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener contexto 2D'));
        return;
      }

      try {
        ctx.drawImage(imageElement, 0, 0, w, h, 0, 0, drawW, drawH);
      } catch (err) {
        reject(new Error('La imagen no se puede procesar (CORS). Prueba recortando primero o subiendo la imagen de nuevo.'));
        return;
      }

      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, drawW, drawH);
      } catch (err) {
        reject(new Error('No se puede leer la imagen (CORS). Recorta primero o sube la imagen de nuevo.'));
        return;
      }

      const data = imageData.data;
      let hex = String(colorHex || '').replace(/^#/, '').trim();
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      let r0 = parseInt(hex.slice(0, 2), 16);
      let g0 = parseInt(hex.slice(2, 4), 16);
      let b0 = parseInt(hex.slice(4, 6), 16);
      if (Number.isNaN(r0) || Number.isNaN(g0) || Number.isNaN(b0)) {
        r0 = 255;
        g0 = 255;
        b0 = 255;
      }
      r0 = Math.max(0, Math.min(255, r0));
      g0 = Math.max(0, Math.min(255, g0));
      b0 = Math.max(0, Math.min(255, b0));

      const t = Math.min(100, Math.max(0, tolerancePercent)) / 100;
      const channelThreshold = Math.round(t * 255);
      if (channelThreshold >= 254) {
        reject(new Error('La tolerancia no puede ser 100% (eliminaría toda la imagen). Usa un valor menor.'));
        return;
      }

      let removedCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dr = Math.abs(r - r0);
        const dg = Math.abs(g - g0);
        const db = Math.abs(b - b0);
        if (dr <= channelThreshold && dg <= channelThreshold && db <= channelThreshold) {
          data[i + 3] = 0;
          removedCount++;
        }
      }

      if (removedCount === 0) {
        reject(new Error('No se encontraron píxeles con ese color. Comprueba el color, sube la tolerancia o recorta la imagen primero (evita CORS).'));
        return;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    if (useElement) {
      run(imageSource);
      return;
    }

    img.onload = () => run(img);
    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    img.crossOrigin = 'anonymous';
    img.src = imageSource;
  });
}
