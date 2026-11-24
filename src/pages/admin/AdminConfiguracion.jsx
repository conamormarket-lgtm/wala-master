import conInterruptor from '../../components/panel/conInterruptor';
import ConfiguracionDelPanel from '../../components/panel/ConfiguracionDelPanel';

// D8 (guia/ADMIN.md): la página del kit; adminAjustesViejo vuelve a la de antes.
export default conInterruptor('adminAjustes', ConfiguracionDelPanel, () => import('./AdminConfiguracionViejo'));
