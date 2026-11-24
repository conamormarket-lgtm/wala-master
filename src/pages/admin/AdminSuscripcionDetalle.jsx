import conInterruptor from '../../components/panel/conInterruptor';
import { SuscripcionDelPanel } from '../../components/panel/SorteosDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', SuscripcionDelPanel, () => import('./AdminSuscripcionDetalleViejo'));
