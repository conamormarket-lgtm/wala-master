import conInterruptor from '../../../components/panel/conInterruptor';
import { DetalleTecnicoDelPanel } from '../../../components/panel/ResultadosTecnicoDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', DetalleTecnicoDelPanel, () => import('./DetalleTecnicoViejo'));
