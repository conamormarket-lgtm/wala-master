import conInterruptor from '../../../components/panel/conInterruptor';
import { VisitantesDelPanel } from '../../../components/panel/ResultadosDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', VisitantesDelPanel, () => import('./VisitantesViejo'));
