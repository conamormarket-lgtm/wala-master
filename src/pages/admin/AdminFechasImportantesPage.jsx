import conInterruptor from '../../components/panel/conInterruptor';
import FechasDelPanel from '../../components/panel/FechasDelPanel';

// D5 (guia/ADMIN.md): la página del kit; adminClientesViejo vuelve a la de antes.
export default conInterruptor('adminClientes', FechasDelPanel, () => import('./AdminFechasImportantesPageViejo'));
