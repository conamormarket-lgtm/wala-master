import conInterruptor from '../../components/panel/conInterruptor';
import { EnlaceDelPanel } from '../../components/panel/EnlacesDelPanel';

// D6 (guia/ADMIN.md): la página del kit; adminCampanasViejo vuelve a la de antes.
export default conInterruptor('adminCampanas', EnlaceDelPanel, () => import('./AdminEnlaceEditorViejo'));
