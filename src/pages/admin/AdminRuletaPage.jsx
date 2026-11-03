import conInterruptor from '../../components/panel/conInterruptor';
import RuletaDelPanel from '../../components/panel/RuletaDelPanel';

// D7 (guia/ADMIN.md): la página del kit; adminJuegosViejo vuelve a la de antes.
export default conInterruptor('adminJuegos', RuletaDelPanel, () => import('./AdminRuletaPageViejo'));
