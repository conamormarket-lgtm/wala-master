import conInterruptor from '../../components/panel/conInterruptor';
import { SuscripcionesDelPanel } from '../../components/panel/SorteosDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', SuscripcionesDelPanel, () => import('./AdminSuscripcionSorteosViejo'));
