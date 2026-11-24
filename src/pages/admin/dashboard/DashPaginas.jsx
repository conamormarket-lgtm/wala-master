import conInterruptor from '../../../components/panel/conInterruptor';
import { PaginasTecnicaDelPanel } from '../../../components/panel/ResultadosTecnicoDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', PaginasTecnicaDelPanel, () => import('./DashPaginasViejo'));
