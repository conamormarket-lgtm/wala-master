import conInterruptor from '../../../components/panel/conInterruptor';
import PlantillasYoryoDelPanel from '../../../components/panel/PlantillasYoryoDelPanel';

// D2 (guia/ADMIN.md): la página del kit (los pasos siguen en esta carpeta);
// adminProductosViejo vuelve a la pantalla de antes.
export default conInterruptor('adminProductos', PlantillasYoryoDelPanel, () => import('./ImportarPlantillasYoryoViejo'));
