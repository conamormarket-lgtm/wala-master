/**
 * La caja de un diseño de fabric en unidades de su zona. El resto de las
 * guías (el imán, las líneas, los cm) está en utils/guiasInteligentes.js.
 */
import { fabric } from 'fabric';
import { desdeLienzo } from './renderDiseno';

export { imanAlMover, imanAlEscalar, enCm } from '../../utils/guiasInteligentes';

/** Caja de un diseño (o de un grupo elegido) en unidades de su zona. */
export const cajaEnZona = (obj, t) => {
  // Dentro de un grupo, fabric da las esquinas relativas al grupo: se pasan al lienzo.
  const delGrupo = obj.group ? obj.group.calcTransformMatrix() : null;
  const pts = obj.getCoords(true, true)
    .map((pt) => (delGrupo ? fabric.util.transformPoint(pt, delGrupo) : pt))
    .map((pt) => desdeLienzo(t, pt.x, pt.y));
  const xs = pts.map((pt) => pt.left);
  const ys = pts.map((pt) => pt.top);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
};
