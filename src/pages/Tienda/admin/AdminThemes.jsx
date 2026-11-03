import conInterruptor from '../../../components/panel/conInterruptor';
import { TemasDelPanel } from '../../../components/panel/CampanasDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', TemasDelPanel, () => import('./AdminThemesViejo'));
