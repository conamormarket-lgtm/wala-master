import conInterruptor from '../../components/panel/conInterruptor';
import { RecomendarDelPanel } from '../../components/panel/ProductosDelPanel';

// D2 (guia/ADMIN.md): la página del kit; adminProductosViejo vuelve a la de antes.
export default conInterruptor('adminProductos', RecomendarDelPanel, () => import('./AdminPublicoProductosViejo'));
