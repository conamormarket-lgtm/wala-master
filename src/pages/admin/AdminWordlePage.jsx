import conInterruptor from '../../components/panel/conInterruptor';
import { PalabraDelPanel } from '../../components/panel/JuegosDelPanel';

// D7 (guia/ADMIN.md): la página del kit; adminJuegosViejo vuelve a la de antes.
export default conInterruptor('adminJuegos', PalabraDelPanel, () => import('./AdminWordlePageViejo'));
