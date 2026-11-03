import conInterruptor from '../../components/panel/conInterruptor';
import { RecompensasDelPanel } from '../../components/panel/FidelidadDelPanel';

// D5 (guia/ADMIN.md): la página del kit; adminClientesViejo vuelve a la de antes.
export default conInterruptor('adminClientes', RecompensasDelPanel, () => import('./AdminRecompensasViejo'));
