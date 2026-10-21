import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PanelBottom } from 'lucide-react';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getCollections } from '../../services/collections';
import { getBrands } from '../../services/brands';
import { getCategories } from '../../services/categories';
import { getProductsByBrand } from '../../services/products';
import { getDocument } from '../../services/firebase/firestore';
import { uploadFile } from '../../services/firebase/storage';
import { getLandingPageBySlug, saveLandingPage } from '../../pages/Tienda/services/landingPages';
import { getThemes } from '../../pages/Tienda/services/themes';
import { getDefaultSettings } from '../../pages/Tienda/services/storefront';
import CategoryNavEditor from '../admin/CategoryNavEditor/CategoryNavEditor';
import PanelEditor from '../../componentes/kit/editor/PanelEditor';
import { ControlOpciones, ControlInterruptor } from '../../componentes/kit/editor/CamposEditor';
import Boton from '../../componentes/kit/Boton';
import { useConfirmar } from '../../componentes/kit/Feedback';
import { COLUMNAS_POR_DEFECTO } from '../marco/columnasDelPie';
import s from './EditorDeTienda.module.css';

// La página vacía puede empezar con la misma base que ofrecía el editor de antes.
const BASE = [
  { type: 'hero_banner', settings: { title: '¡Lanza tu Producto Hoy!', subtitle: 'Una estructura perfecta diseñada para convertir visitantes en clientes.', buttonText: 'Comprar Ahora' } },
  { type: 'marquee', settings: { items: [{ name: 'Confianza', imageUrl: '' }, { name: 'Calidad', imageUrl: '' }, { name: 'Garantía', imageUrl: '' }] } },
  { type: 'text', settings: { heading: 'Beneficios de Nuestro Producto', content: 'Explica brevemente por qué tu cliente necesita esto. Usa viñetas o texto directo que resalte el valor principal.', textAlign: 'center' } },
  { type: 'bestsellers_row', settings: { cards: [{ title: 'Destacado 1', subtitle: 'Lo más vendido', imageUrl: '' }, { title: 'Destacado 2', subtitle: 'Nuevo ingreso', imageUrl: '' }] } },
  { type: 'testimonials', settings: { title: 'Lo que dicen nuestros clientes', testimonials: [{ author: 'Juan Pérez', text: 'Excelente servicio, muy recomendado.', rating: 5 }] } },
];

// El menú que dibuja la cabecera cuando la página no guardó uno (CabeceraDeTienda).
const MENU_POR_DEFECTO = [
  { id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true },
  { id: '2', text: 'Suscripciones', type: 'link', url: '/suscripciones' },
  { id: '3', text: 'Crear', type: 'link', url: '/personalizar' },
];

const PAGINAS_GLOBALES = ['home', 'tienda', 'footer'];
// El pie solo dibuja columnas, texto e imagen (Footer.jsx), y empieza con las columnas de siempre.
const TIPOS_DEL_PIE = ['footer_columns', 'text', 'image'];
const BASE_DEL_PIE = [{ type: 'footer_columns', settings: { columns: COLUMNAS_POR_DEFECTO } }];
const tituloDePagina = (id) => (id ? { home: 'Inicio', tienda: 'Tienda', footer: 'Pie de página' }[id] || `/${id}` : 'Cargando…');
const ordenadas = (lista) => [...lista].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/*
 * Salir de la página con cambios sin publicar: el borrador es de esta página
 * y al cambiar de página se recarga. Los enlaces preguntan antes (los de una
 * sección sin abrir no navegan: la eligen) y recargar o cerrar la pestaña
 * avisa el navegador. Editando el pie no hace falta: el pie sigue al cambiar.
 */
function useAvisoAlSalir(activo) {
  const navigate = useNavigate();
  const confirmar = useConfirmar();
  useEffect(() => {
    if (!activo) return undefined;
    const alClic = async (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (a.closest('[data-seccion-editable="cerrada"]')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      const salir = await confirmar({ titulo: '¿Cambiar de página sin publicar?', texto: 'Los cambios que no publicaste en esta página se pierden.', confirmar: 'Cambiar', peligro: true });
      if (!salir) return;
      // El aviso se cierra con un "atrás" (useCerrarConAtras): navegar antes
      // de que llegue lo deshace. Se espera ese atrás (o un momento, si ya pasó).
      await new Promise((listo) => {
        const fin = () => { window.removeEventListener('popstate', fin); window.clearTimeout(t); listo(); };
        const t = window.setTimeout(fin, 400);
        window.addEventListener('popstate', fin);
      });
      navigate(url.pathname + url.search + url.hash);
    };
    const alCerrar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('click', alClic, true);
    window.addEventListener('beforeunload', alCerrar);
    return () => {
      window.removeEventListener('click', alClic, true);
      window.removeEventListener('beforeunload', alCerrar);
    };
  }, [activo, navigate, confirmar]);
}

/*
 * Pestaña "Página" de una landing: su tema y si oculta la cabecera o el pie.
 * Se guardan al momento en la landing (como el editor de antes), sin
 * "Publicar". Al guardar se manda también su marca: saveLandingPage la
 * escribe siempre y sin ella la borraba.
 */
function AjustesDeLanding({ slug }) {
  const { isHeaderVisible, setHeaderVisible, isFooterVisible, setFooterVisible } = useLayoutContext();
  const queryClient = useQueryClient();
  const { data: temas } = useQuery({ queryKey: ['admin-themes'], queryFn: getThemes });
  const { data: landing } = useQuery({ queryKey: ['editor-landing', slug], queryFn: () => getLandingPageBySlug(slug) });
  const guardar = async (cambios) => {
    if (!landing?.id) return;
    await saveLandingPage(landing.id, { ...cambios, brandId: landing.brandId || '' });
    queryClient.setQueryData(['editor-landing', slug], { ...landing, ...cambios });
  };
  if (!landing) return <p>Esta página no es una landing guardada: no tiene ajustes propios.</p>;
  return (
    <>
      <ControlOpciones
        etiqueta="Tema visual"
        ayuda="Cambia los colores solo en esta landing. Se ve al recargar la página."
        valor={landing.themeId || ''}
        opciones={[{ valor: '', texto: 'El de la tienda' }, ...(temas || []).map((t) => ({ valor: t.id, texto: t.name || t.id }))]}
        onCambiar={(themeId) => guardar({ themeId })}
      />
      <ControlInterruptor
        etiqueta="Ocultar la cabecera"
        descripcion="Para una landing sin distracciones."
        valor={!isHeaderVisible}
        onCambiar={(ocultar) => { setHeaderVisible(!ocultar); guardar({ hideHeader: ocultar }); }}
      />
      <ControlInterruptor
        etiqueta="Ocultar el pie de página"
        valor={!isFooterVisible}
        onCambiar={(ocultar) => { setFooterVisible(!ocultar); guardar({ hideFooter: ocultar }); }}
      />
    </>
  );
}

/*
 * El editor del builder con el kit (paso 8), en lugar de VisualEditorPanel.
 * Lee y escribe el mismo borrador (VisualEditorContext): las páginas, la
 * cabecera y el pie siguen dibujando lo que se edita al instante, y publicar
 * guarda igual que antes (página bloqueada, homePage + secciones, copia en
 * storeConfigLogs, caché). Los datos de los selectores son los del editor de
 * antes: colecciones, marcas y, en la página de una marca, solo las
 * categorías que usan sus productos.
 * Interruptor editorViejo: vuelve VisualEditorPanel.
 */
export default function EditorDeTienda() {
  const ed = useVisualEditor();
  const {
    activeSection, openEditorForSection, closeEditor, hoveredSectionId, setHoveredSectionId,
    editorPosition, setEditorPosition, activePageId, setActivePageId, paginaDelBuilder, storeConfigDraft, updateDraft, updateSectionsDraft,
    saveDraftToFirestore, isSaving, isPreviewMobile, toggleMobilePreview, toggleEditMode,
    deshacer, rehacer, puedeDeshacer, puedeRehacer, sinGuardar, insertarEn, setInsertarEn,
  } = ed;
  const toast = useGlobalToast();
  const confirmar = useConfirmar();
  useAvisoAlSalir(sinGuardar && activePageId !== 'footer');

  // ── Datos de los selectores (las mismas consultas que el editor de antes).
  const { data: colecciones } = useQuery({ queryKey: ['admin-collections'], queryFn: async () => (await getCollections()).data || [] });
  const { data: marcas } = useQuery({ queryKey: ['admin-brands'], queryFn: async () => (await getBrands()).data || [] });
  const { data: todasLasCategorias } = useQuery({ queryKey: ['admin-categories'], queryFn: async () => (await getCategories()).data || [] });
  const { data: marcaDeLaPagina } = useQuery({
    queryKey: ['editor-page-brand', activePageId],
    queryFn: async () => {
      if (!activePageId || PAGINAS_GLOBALES.includes(activePageId)) return null;
      const lp = await getLandingPageBySlug(activePageId);
      return lp?.brandId || null;
    },
  });
  // Los valores de categoría que de verdad usan los productos de la marca.
  const { data: valoresDeMarca } = useQuery({
    queryKey: ['editor-brand-cat-values', marcaDeLaPagina],
    queryFn: async () => {
      const { data } = await getProductsByBrand(marcaDeLaPagina);
      const vals = new Set();
      (data || []).forEach((p) => {
        (Array.isArray(p.categories) ? p.categories : []).forEach((c) => {
          const v = c && typeof c === 'object' ? c.id : c;
          if (v) vals.add(v);
        });
        const una = p.category && typeof p.category === 'object' ? p.category.id : p.category;
        if (una) vals.add(una);
      });
      return [...vals];
    },
    enabled: !!marcaDeLaPagina,
  });
  // Cada una leída por su id (tienda_categories y, si no, categories).
  const { data: docsDeMarca } = useQuery({
    queryKey: ['editor-brand-cat-docs', (valoresDeMarca || []).slice().sort().join(',')],
    queryFn: async () => {
      const out = {};
      await Promise.all((valoresDeMarca || []).map(async (id) => {
        let r = await getDocument('tienda_categories', id);
        if (!r?.data) r = await getDocument('categories', id);
        out[id] = r?.data ? { name: r.data.name || '', imageUrl: r.data.imageUrl || '' } : { name: '', imageUrl: '' };
      }));
      return out;
    },
    enabled: !!marcaDeLaPagina && Array.isArray(valoresDeMarca) && valoresDeMarca.length > 0,
  });
  const categorias = useMemo(() => {
    const todas = todasLasCategorias || [];
    const base = marcaDeLaPagina && Array.isArray(valoresDeMarca)
      ? valoresDeMarca.map((v) => {
        const doc = docsDeMarca?.[v];
        const global = todas.find((c) => c.id === v);
        return { id: v, name: doc?.name || global?.name || v, imageUrl: doc?.imageUrl || global?.imageUrl || '' };
      })
      : todas;
    const vistos = new Set();
    return base.filter((c) => {
      const k = (c.name || c.id).trim().toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }, [todasLasCategorias, valoresDeMarca, docsDeMarca, marcaDeLaPagina]);

  // El panel tapa un costado: la página se corre (escritorio) para seguir a la vista.
  const lado = editorPosition === 'left' ? 'izquierda' : 'derecha';
  useEffect(() => {
    document.body.classList.add('editor-kit', `editor-kit-${lado}`);
    return () => document.body.classList.remove('editor-kit', `editor-kit-${lado}`);
  }, [lado]);

  const secciones = useMemo(() => ordenadas(storeConfigDraft?.sections || []), [storeConfigDraft]);
  const config = storeConfigDraft || {};

  // ── Toda la tienda: en todas las páginas (la cabecera y el pie son los mismos).
  const enPie = activePageId === 'footer';
  const global = (id, porDefecto) => ({ id, esquema: id, ajustes: config[id] || porDefecto || {}, onCambiar: (parche) => updateDraft(id, parche) });
  // El pie es su propia página: el panel pasa a editarlo (y vuelve con "Volver a la página").
  const cambiarDePagina = async (id) => {
    if (sinGuardar && !(await confirmar({ titulo: '¿Cambiar sin publicar?', texto: 'Los cambios que no publicaste se pierden.', confirmar: 'Cambiar', peligro: true }))) return;
    setActivePageId(id);
    if (id === 'footer') window.setTimeout(() => document.getElementById('site-footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };
  const globales = [
    global('header', { navLinks: MENU_POR_DEFECTO }),
    global('accountPopup'),
    global('favoritesPopup'),
    global('searchPage'),
    !enPie && { id: 'pie', nombre: 'Pie de página', descripcion: 'Columnas y enlaces del final, en todas las páginas.', icono: PanelBottom, onAbrir: () => cambiarDePagina('footer') },
  ].filter(Boolean);
  // Volver a la página solo si la que está en pantalla la arma el builder; si
  // no (el carrito, la cuenta…), aquí solo se edita lo de toda la tienda.
  const cabeceraDelPanel = !enPie ? null : paginaDelBuilder ? (
    <div className={s.volver}>
      <Boton variante="contorno" tamano="sm" bloque icono={<ArrowLeft aria-hidden="true" />} onClick={() => cambiarDePagina('pagina')}>
        Volver a la página
      </Boton>
    </div>
  ) : (
    <p className={s.aviso} role="note">Esta página no se arma con el editor: aquí se editan la cabecera, el pie y lo de toda la tienda.</p>
  );
  const esLanding = activePageId && !PAGINAS_GLOBALES.includes(activePageId);

  const publicar = async () => {
    const r = await saveDraftToFirestore({ avisar: false });
    if (r?.success) toast.success('Cambios publicados.');
    else if (r?.bloqueada) toast.error(`Esta página (${activePageId}) está bloqueada por un administrador: no se pueden guardar cambios.`);
    else toast.error(`No se pudo publicar: ${r?.error || 'inténtalo de nuevo'}`);
  };

  const salir = async () => {
    if (sinGuardar && !(await confirmar({ titulo: '¿Salir sin publicar?', texto: 'Los cambios que no publicaste se pierden.', confirmar: 'Salir', peligro: true }))) return;
    toggleEditMode();
  };

  const nombreMarca = (id) => (marcas || []).find((m) => m.id === id)?.name || '';

  return (
    <div className={s.editor}>
      <PanelEditor
        titulo={tituloDePagina(activePageId)}
        secciones={secciones}
        onCambiar={(lista, clave) => updateSectionsDraft(lista, clave)}
        seleccionada={activeSection}
        onSeleccionar={(id) => (id ? openEditorForSection(id, storeConfigDraft) : closeEditor())}
        resaltada={hoveredSectionId}
        onResaltar={setHoveredSectionId}
        insertarEn={insertarEn}
        onInsertarEn={(i) => { setInsertarEn(i); if (i != null) closeEditor(); }}
        crearAjustes={getDefaultSettings}
        fuentes={{ colecciones: colecciones || [], categorias, marcas: marcas || [], subirArchivo: uploadFile, pieConRedes: true }}
        extensiones={{
          burbujasDeMarca: ({ ajustes }) => <CategoryNavEditor brandId={ajustes.brandId} brandName={nombreMarca(ajustes.brandId)} />,
        }}
        globales={globales}
        cabecera={cabeceraDelPanel}
        tituloSecciones={enPie ? 'Pie de página' : 'Esta página'}
        ajustesPagina={esLanding ? <AjustesDeLanding slug={activePageId} /> : undefined}
        base={activePageId === 'footer' ? BASE_DEL_PIE : BASE}
        tipos={activePageId === 'footer' ? TIPOS_DEL_PIE : undefined}
        onGuardar={publicar}
        guardando={isSaving}
        sinGuardar={sinGuardar}
        onDeshacer={deshacer}
        onRehacer={rehacer}
        puedeDeshacer={puedeDeshacer}
        puedeRehacer={puedeRehacer}
        vista={isPreviewMobile ? 'movil' : 'escritorio'}
        onVista={toggleMobilePreview}
        lado={lado}
        onLado={(l) => setEditorPosition(l === 'izquierda' ? 'left' : 'right')}
        onCerrar={salir}
      />
    </div>
  );
}
