import conInterruptor from '../../components/panel/conInterruptor';
import CategoriasDelPanel from '../../components/panel/CategoriasDelPanel';

// D1 (guia/ADMIN.md): la página del kit; adminCatalogoViejo vuelve a la de antes.
export default conInterruptor('adminCatalogo', CategoriasDelPanel, () => import('./AdminCategoriasViejo'));
