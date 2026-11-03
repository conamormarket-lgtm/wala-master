import conInterruptor from '../../components/panel/conInterruptor';
import { MisionesDelPanel } from '../../components/panel/FidelidadDelPanel';

// D5 (guia/ADMIN.md): la página del kit; adminClientesViejo vuelve a la de antes.
export default conInterruptor('adminClientes', MisionesDelPanel, () => import('./AdminMisionesViejo'));
