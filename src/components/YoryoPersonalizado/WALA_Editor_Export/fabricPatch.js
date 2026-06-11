/**
 * Parche para Fabric.js: evita que renderAll/renderAndReset lancen
 * "Cannot read properties of null (reading 'clearRect')" cuando el canvas
 * ya fue disposed (p. ej. al actualizar la página o cambiar de vista).
 * Así el overlay de errores de React no aparece.
 */
import { fabric } from 'fabric';

const isClearRectError = (e) =>
  e && typeof e.message === 'string' && e.message.includes("reading 'clearRect')");

if (typeof fabric !== 'undefined' && fabric.Canvas) {
  const origRenderAll = fabric.Canvas.prototype.renderAll;
  if (typeof origRenderAll === 'function') {
    fabric.Canvas.prototype.renderAll = function (...args) {
      try {
        return origRenderAll.apply(this, args);
      } catch (e) {
        if (isClearRectError(e)) return;
        throw e;
      }
    };
  }

  const origRenderAndReset = fabric.Canvas.prototype.renderAndReset;
  if (typeof origRenderAndReset === 'function') {
    fabric.Canvas.prototype.renderAndReset = function (...args) {
      try {
        return origRenderAndReset.apply(this, args);
      } catch (e) {
        if (isClearRectError(e)) return;
        throw e;
      }
    };
  }
}
