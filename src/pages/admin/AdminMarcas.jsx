import conInterruptor from '../../components/panel/conInterruptor';
import MarcasDelPanel from '../../components/panel/MarcasDelPanel';

// D1 (guia/ADMIN.md): la página del kit; adminCatalogoViejo vuelve a la de antes.
export default conInterruptor('adminCatalogo', MarcasDelPanel, () => import('./AdminMarcasViejo'));
