import conInterruptor from '../../../components/panel/conInterruptor';
import { ProductosResultadosDelPanel } from '../../../components/panel/ResultadosDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', ProductosResultadosDelPanel, () => import('./ProductosViejo'));
