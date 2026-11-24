import conInterruptor from '../../components/panel/conInterruptor';
import { HistorialDelPanel } from '../../components/panel/AjustesDelPanel';

// D8 (guia/ADMIN.md): la página del kit; adminAjustesViejo vuelve a la de antes.
export default conInterruptor('adminAjustes', HistorialDelPanel, () => import('./AdminBackupsViejo'));
