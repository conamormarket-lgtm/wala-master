import conInterruptor from '../../components/panel/conInterruptor';
import { SorteoDelPanel } from '../../components/panel/SorteosDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', SorteoDelPanel, () => import('./AdminSorteoDetalleViejo'));
