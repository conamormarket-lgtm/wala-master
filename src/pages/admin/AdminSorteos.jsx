import conInterruptor from '../../components/panel/conInterruptor';
import { SorteosDelPanel } from '../../components/panel/SorteosDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', SorteosDelPanel, () => import('./AdminSorteosViejo'));
