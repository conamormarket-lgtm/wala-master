import conInterruptor from '../../components/panel/conInterruptor';
import { AtributosDelPanel } from '../../components/panel/CatalogoDelPanel';

// D1 (guia/ADMIN.md): la página del kit; adminCatalogoViejo vuelve a la de antes.
export default conInterruptor('adminCatalogo', AtributosDelPanel, () => import('./AdminCatalogAttributesViejo'));
