import conInterruptor from '../../../components/panel/conInterruptor';
import { LandingsDelPanel } from '../../../components/panel/CampanasDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', LandingsDelPanel, () => import('./AdminLandingPagesViejo'));
