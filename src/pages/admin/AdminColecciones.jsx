import conInterruptor from '../../components/panel/conInterruptor';
import { ColeccionesDelPanel } from '../../components/panel/CatalogoDelPanel';

// D1 (guia/ADMIN.md): la página del kit; adminCatalogoViejo vuelve a la de antes.
export default conInterruptor('adminCatalogo', ColeccionesDelPanel, () => import('./AdminColeccionesViejo'));
