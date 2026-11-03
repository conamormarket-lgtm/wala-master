import conInterruptor from '../../components/panel/conInterruptor';
import { EncuestaDelPanel } from '../../components/panel/AvisosDelPanel';

// D5 (guia/ADMIN.md): la página del kit; adminClientesViejo vuelve a la de antes.
export default conInterruptor('adminClientes', EncuestaDelPanel, () => import('./AdminEncuestasViejo'));
