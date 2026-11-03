import conInterruptor from '../../components/panel/conInterruptor';
import { CuentasDePedidosDelPanel } from '../../components/panel/PedidosDelPanel';

// D3 (guia/ADMIN.md): la página del kit; adminPedidosViejo vuelve a la de antes.
export default conInterruptor('adminPedidos', CuentasDePedidosDelPanel, () => import('./AdminCrearCuentasPedidosViejo'));
