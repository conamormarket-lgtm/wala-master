import conInterruptor from '../../components/panel/conInterruptor';
import BlueprintsDelPanel from '../../components/panel/BlueprintsDelPanel';

// D2 (guia/ADMIN.md): la página del kit; adminProductosViejo vuelve a la de antes.
export default conInterruptor('adminProductos', BlueprintsDelPanel, () => import('./AdminBlueprintsViejo'));
