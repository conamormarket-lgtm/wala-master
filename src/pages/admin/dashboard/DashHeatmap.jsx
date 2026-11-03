import conInterruptor from '../../../components/panel/conInterruptor';
import { MapaDeCalorDelPanel } from '../../../components/panel/ResultadosTecnicoDelPanel';

// D4 (guia/ADMIN.md): la página del kit; adminResultadosViejo vuelve a la de antes.
export default conInterruptor('adminResultados', MapaDeCalorDelPanel, () => import('./DashHeatmapViejo'));
