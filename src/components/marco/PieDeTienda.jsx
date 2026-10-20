import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStorefrontConfig } from '../../pages/Tienda/services/storefront';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';
import { esAppNativa } from '../../utils/vistaPreviaCalor';
import { empresa } from '../../config/empresa';
import useLoViejo from '../../hooks/useLoViejo';
import Boton from '../../componentes/kit/Boton';
import { useConfirmar } from '../../componentes/kit/Feedback';
import { PieLegal } from '../../componentes/kit/piezas/Marco';
import { MarcoPie, ColumnasPie, TextoPie, ImagenPie } from '../../componentes/kit/piezas/Pie';
import { pieLegalDesdeEmpresa } from '../../componentes/kit/adaptadores';
import EditableSection from '../admin/EditableSection';
import PuntoDeInsercion from '../constructor/PuntoDeInsercion';
import { COLUMNAS_POR_DEFECTO } from './columnasDelPie';
import { sinKapiFlotante, sinKapiEnPie } from './kapiFlotante';
import s from './PieDeTienda.module.css';

/*
 * El pie de página (M5) con el kit: MarcoPie con los bloques que guarda el
 * builder en pages/footer (columnas, texto e imagen) y la franja legal.
 * Lo mismo que Footer.jsx de antes:
 *  - las columnas de siempre si no hay nada guardado; 10 min en caché
 *  - no sale si la página lo apaga, en la app ni en el estudio (/crear/)
 *  - el editor del kit: "Editar el pie de página", "Estás editando…", el "+"
 *    entre bloques y cada bloque con su EditableSection
 * Kapi se asoma por el pie solo cuando no flota el de la esquina (con perfil
 * y fuera de las páginas que lo ocultan), la página no termina con otro
 * (Preguntas frecuentes) ni trae el suyo (kapiFlotante.js): un solo Kapi a
 * la vista.
 * Lo de antes (FooterViejo.jsx) baja con el interruptor pieViejo o con
 * editorViejo (su editor dibuja ahí).
 */
export default function PieDeTienda() {
  const location = useLocation();
  const { isEditModeActive, activePageId, setActivePageId, storeConfigDraft, sinGuardar } = useVisualEditor();
  const layout = useLayoutContext();
  const { user, userProfile } = useAuth();
  const crearViejo = useLoViejo('crear');
  const confirmar = useConfirmar();

  const { data: config, isLoading } = useQuery({
    queryKey: ['storefront-config', 'footer'],
    queryFn: async () => {
      const { sections, error } = await getStorefrontConfig('footer');
      if (error) throw new Error(error);
      return { sections: sections ?? [] };
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!layout?.isFooterVisible) return null;
  if (window.Capacitor?.isNativePlatform?.() || esAppNativa()) return null;
  // El estudio es una herramienta: sin pie, como en el kit (P12).
  if (location.pathname.startsWith('/crear/') && !crearViejo) return null;

  const editando = isEditModeActive && activePageId === 'footer';
  let bloques = editando ? (storeConfigDraft?.sections || []) : (config?.sections || []);
  if (!isLoading && bloques.length === 0) {
    bloques = [{ id: 'default_footer', type: 'footer_columns', order: 0, settings: { columns: COLUMNAS_POR_DEFECTO } }];
  }

  const kapiFlota = Boolean(userProfile) && layout.isHeaderVisible !== false && !layout.kapiFlotanteOculto && !sinKapiFlotante(location.pathname);
  const kapi = !kapiFlota && !layout.pieSinKapi && !sinKapiEnPie(location.pathname, { sesion: Boolean(user) });
  const paginaActual = location.pathname === '/' || location.pathname === '/home' ? 'home'
    : location.pathname.replace(/^\/+/, '').split('/')[0] || 'home';

  const contenido = (bloque) => {
    const ajustes = bloque.settings || {};
    if (bloque.type === 'footer_columns') return <ColumnasPie columnas={ajustes.columns || []} />;
    if (bloque.type === 'text') return <TextoPie titulo={ajustes.heading} texto={ajustes.content} />;
    if (bloque.type === 'image') return <ImagenPie url={ajustes.url} alt={ajustes.alt} />;
    return null;
  };

  return (
    <div id="site-footer" className={s.envoltura} data-componente="PiePagina">
      {isEditModeActive && !editando && (
        <div className={s.editarPie}>
          <Boton onClick={() => setActivePageId('footer')}>Editar el pie de página</Boton>
        </div>
      )}
      {editando && (
        <div className={s.editandoPie} role="status">
          <span>Estás editando el pie de página: se ve en todas las páginas.</span>
          <Boton
            variante="contorno"
            tamano="sm"
            onClick={async () => {
              if (sinGuardar && !(await confirmar({ titulo: '¿Volver sin publicar el pie?', texto: 'Los cambios del pie que no publicaste se pierden.', confirmar: 'Volver', peligro: true }))) return;
              setActivePageId(paginaActual);
            }}
          >
            Volver a la página
          </Boton>
        </div>
      )}
      <div className={s.ancho}>
        <MarcoPie kapi={kapi} pieLegal={<PieLegal {...pieLegalDesdeEmpresa(empresa)} />}>
          {bloques.map((bloque, i) => (
            <React.Fragment key={bloque.id || i}>
              {editando && <PuntoDeInsercion indice={i} />}
              {editando
                ? <EditableSection sectionId={bloque.id} tipo={bloque.type} currentConfig={storeConfigDraft}>{contenido(bloque)}</EditableSection>
                : contenido(bloque)}
            </React.Fragment>
          ))}
          {editando && <PuntoDeInsercion indice={bloques.length} />}
        </MarcoPie>
      </div>
    </div>
  );
}
