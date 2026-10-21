import { useBloquearScroll as useBloquearScrollKit } from '../componentes/kit/Efectos';

/**
 * Congela el scroll de la página mientras `activo` (modales, cajones…).
 *
 * Usa el candado del kit (componentes/kit/Efectos): uno solo para toda la
 * página. Este llevaba su propio contador y, cruzado con el del loader de
 * marca, dejaba la página sin scroll.
 */
export const useBloquearScroll = (activo = true) => useBloquearScrollKit(activo);

export default useBloquearScroll;
