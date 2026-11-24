import conInterruptor from '../../../components/panel/conInterruptor';
import { ClientesResultadosDelPanel } from '../../../components/panel/ResultadosClientesDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', ClientesResultadosDelPanel, () => import('./ClientesViejo'));
