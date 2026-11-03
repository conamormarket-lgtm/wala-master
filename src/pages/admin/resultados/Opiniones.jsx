import conInterruptor from '../../../components/panel/conInterruptor';
import { OpinionesDelPanel } from '../../../components/panel/ResultadosClientesDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', OpinionesDelPanel, () => import('./OpinionesViejo'));
