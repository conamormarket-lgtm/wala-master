import React, { useCallback, useState } from 'react';
import {
  PanelEditor, useBorrador, SeccionEditable, InsertarAqui, RenderSecciones, moverSeccion, duplicarSeccion,
  useToast, Interruptor,
} from './kit';
import s from './DemoEditor.module.css';

/*
 * Editor del builder en vivo. La página de ejemplo está escrita como la
 * guarda Firestore (pages/{pageId}.sections) y se edita con el mismo panel que
 * usaría la tienda. "Publicar" aquí solo simula el guardado.
 */

const crearPagina = (img) => [
  { id: 'e0', type: 'announcement_bar', order: -1, settings: {
    messages: [
      { text: '🎁 Envoltura de regalo gratis en pedidos Con Amor', link: '/conamor' },
      { text: '🚚 Llega en 48 h a Lima y 3 a 5 días a provincias', link: '' },
    ],
    variant: 'soft', density: 'comfortable', bgColor: '#db2777', textColor: '#ffffff', animationType: 'fade', speed: 5000, showAccent: true,
  } },
  { id: 'e1', type: 'hero_banner', order: 0, settings: {
    mediaType: 'image', mediaUrl: '/crear/banner-crear-1200.webp', eyebrow: 'Con Amor', title: 'Regalos que se recuerdan', subtitle: 'Tu foto, tu frase y nuestro taller. Listo en 48 horas.',
    buttonText: 'Crear el mío', buttonLink: '/personalizar', textAlign: 'left', textPosition: 'center', overlayOpacity: 55, minHeight: '420px',
    paddingTop: '1rem', paddingBottom: '0.5rem',
  } },
  { id: 'e2', type: 'categories_nav', order: 1, settings: { brandId: 'conamor', paddingTop: '1rem', paddingBottom: '0.5rem' } },
  { id: 'e3', type: 'sidebar_catalog', order: 2, settings: { title: 'Catálogo Con Amor', brandId: 'conamor', paddingTop: '1rem', paddingBottom: '2rem' } },
  { id: 'e4', type: 'feature_list', order: 3, settings: {
    eyebrow: 'Hecho a mano', title: '¿Por qué elegirnos?', subtitle: 'Lo que nos dicen que nos hace distintos.', imageUrl: img.taller, imageAlt: 'Recién salida del taller',
    items: [{ icon: 'paleta', text: 'Estampado que no se cuartea al lavar' }, { icon: 'camion', text: 'Envío a todo el Perú' }, { icon: 'chat', text: 'Te ayudamos con tu diseño por WhatsApp' }],
    quote: 'Pedí tres poleras para el cumple de mi papá y llegaron perfectas.', quoteAuthor: 'Andrea, Lima', paddingTop: '2rem', paddingBottom: '2rem',
  } },
  { id: 'e5', type: 'map_location', order: 4, settings: {
    eyebrow: 'Nuestra tienda', title: 'Visítanos en Lima', description: 'Av. Ejemplo 123, Miraflores\nLunes a sábado de 10 a. m. a 7 p. m.',
    embedUrl: 'https://www.google.com/maps?q=Miraflores,Lima,Peru&output=embed', layout: 'mapRight', mapWidth: '55%', mapHeight: '320px',
    buttonText: 'Escríbenos', buttonLink: 'https://wa.me/51900000000', paddingTop: '2rem', paddingBottom: '2rem',
  } },
  { id: 'e6', type: 'footer_columns', order: 5, settings: {
    columns: [
      { id: 'c1', title: 'Walá', type: 'text', content: 'Prendas y regalos personalizados con amor y dedicación.' },
      { id: 'c2', title: 'Tienda', type: 'links', links: [{ text: 'Catálogo', url: '/tienda' }, { text: 'Crear', url: '/personalizar' }, { text: 'Mi cuenta', url: '/cuenta' }] },
      { id: 'c3', title: 'Síguenos', type: 'social', links: [{ text: 'Instagram', url: 'https://instagram.com/wala.pe' }, { text: 'TikTok', url: 'https://tiktok.com/@wala.pe' }, { text: 'WhatsApp', url: 'https://wa.me/51900000000' }] },
    ],
    paddingTop: '1rem', paddingBottom: '1.5rem',
  } },
];

const COLECCIONES = [{ id: 'ofertas', name: 'Ofertas' }, { id: 'navidad', name: 'Navidad' }, { id: 'san-valentin', name: 'San Valentín' }];

/** Extensión de ejemplo: en la tienda aquí va CategoryNavEditor (guarda en la marca). */
function BurbujasDeMarca() {
  return <p className={s.extension}>Aquí la tienda muestra el editor de burbujas de la marca (CategoryNavEditor), que guarda en el documento de la marca.</p>;
}

export default function DemoEditor({ productos, marcas, categorias, categoriaDe, imagenes, onAgregar }) {
  const toast = useToast();
  const borrador = useBorrador(() => crearPagina(imagenes));
  const [seleccionada, setSeleccionada] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [insertarEn, setInsertarEn] = useState(null);
  const [vista, setVista] = useState('escritorio');
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(true);
  const [categoria, setCategoria] = useState(null);

  const { secciones, cambiar } = borrador;
  const lista = [...secciones].sort((a, b) => a.order - b.order);

  const publicar = useCallback(() => {
    setGuardando(true);
    window.setTimeout(() => {
      setGuardando(false);
      borrador.marcarGuardado();
      toast({ tipo: 'exito', titulo: 'Página publicada', texto: 'Así la verán tus clientes.' });
    }, 900);
  }, [borrador, toast]);

  // Datos que en la tienda salen de consultas (aquí, de ejemplo).
  const productosDe = (sec) => (sec.type === 'sidebar_catalog' && categoria ? productos.filter((p) => categoriaDe(p) === categoria) : productos);
  const grupos = [
    { id: 'tipo', titulo: 'Tipo', opciones: ['Poleras', 'Tazas', 'Peluches', 'Cuadros', 'Parejas'].map((n) => ({ valor: n, nombre: n, cuenta: productos.filter((p) => categoriaDe(p) === n).length })), de: categoriaDe },
    { id: 'personalizable', titulo: 'Personalizable', opciones: [{ valor: 'si', nombre: 'Con tu diseño' }], de: (p) => (p.customizable || p.esPrendaBase ? 'si' : 'no') },
  ];
  const propsPara = (sec) => {
    if (sec.type === 'categories_nav') return { activa: categoria, onSeleccionar: setCategoria };
    if (sec.type === 'sidebar_catalog') return { grupos };
    return undefined;
  };

  const pagina = (
    <RenderSecciones
      secciones={secciones}
      productosPara={productosDe}
      categoriasPara={() => categorias}
      marcasPara={() => marcas}
      propsPara={propsPara}
      onAgregar={onAgregar}
      envolver={editando ? (sec, nodo, i) => (
        <>
          <InsertarAqui indice={i} onInsertar={setInsertarEn} activo={insertarEn === i} />
          <SeccionEditable
            id={sec.id}
            tipo={sec.type}
            activa={seleccionada === sec.id}
            resaltada={resaltada === sec.id}
            primera={i === 0}
            ultima={i === lista.length - 1}
            onEditar={(id) => { setInsertarEn(null); setSeleccionada(id); }}
            onMover={(id, d) => cambiar(moverSeccion(secciones, id, d))}
            onDuplicar={(id) => cambiar(duplicarSeccion(secciones, id))}
          >
            {nodo}
          </SeccionEditable>
        </>
      ) : undefined}
    />
  );

  return (
    <div className={s.demo}>
      <div className={s.controles}>
        <Interruptor etiqueta="Modo edición" descripcion="Apágalo para ver la página como la ve el cliente." activo={editando} onChange={setEditando} />
      </div>
      <div className={[s.estudio, !editando && s.sinPanel].filter(Boolean).join(' ')}>
        <div className={s.lienzo}>
          <div className={[s.pagina, vista === 'movil' && s.paginaMovil].filter(Boolean).join(' ')}>
            {pagina}
            {editando && <InsertarAqui indice={lista.length} onInsertar={setInsertarEn} activo={insertarEn === lista.length} />}
          </div>
        </div>
        {editando && (
          <div className={s.lado}>
            <PanelEditor
              incrustado
              titulo="Landing Con Amor"
              secciones={secciones}
              onCambiar={cambiar}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
              resaltada={resaltada}
              onResaltar={setResaltada}
              insertarEn={insertarEn}
              onInsertarEn={(i) => { setInsertarEn(i); if (i != null) setSeleccionada(null); }}
              fuentes={{ marcas, categorias: categorias.map((c) => ({ id: c.categoryId, name: c.name, imageUrl: c.imageUrl })), colecciones: COLECCIONES, subirArchivo: async (archivo) => ({ url: URL.createObjectURL(archivo) }) }}
              extensiones={{ burbujasDeMarca: BurbujasDeMarca }}
              onGuardar={publicar}
              guardando={guardando}
              sinGuardar={borrador.sinGuardar}
              onDeshacer={borrador.deshacer}
              onRehacer={borrador.rehacer}
              puedeDeshacer={borrador.puedeDeshacer}
              puedeRehacer={borrador.puedeRehacer}
              vista={vista}
              onVista={setVista}
              ajustesPagina={(
                <>
                  <Interruptor etiqueta="Ocultar el menú principal" descripcion="Para landings sin distracciones." activo={false} onChange={() => {}} />
                  <Interruptor etiqueta="Ocultar el pie de página" activo={false} onChange={() => {}} />
                </>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
