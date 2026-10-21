import {
  Image, Images, Megaphone, Heading, Type, Video, Star, LayoutGrid, Layers, Navigation, Grid3x3, Store, ShieldCheck,
  Zap, MessageSquareQuote, Infinity as Cinta, Trophy, PanelBottom, MapPin, ListChecks, CircleHelp, Sparkles, Tag, Clock,
  FolderOpen, Rows3, Menu, UserRound, Heart, Search,
} from 'lucide-react';

/*
 * Esquemas del editor del builder: cada tipo de sección describe UNA vez sus
 * campos y <FormularioSeccion> los dibuja. Antes cada tipo tenía su formulario
 * copiado a mano en VisualEditorPanel.jsx (~3.000 líneas).
 *
 * Los nombres de campo son los mismos que guarda Firestore (settings) y que
 * escribe el editor actual, para que nada se pierda al cambiar de editor.
 *
 * Un campo: { tipo, campo, etiqueta, ayuda?, placeholder?, pestana?, si?(ajustes) }
 *  - pestana: 'contenido' (por defecto) | 'diseno' | 'avanzado'
 *  - si: el campo solo aparece cuando devuelve true
 * Tipos: texto, parrafo, numero, rango, color, imagen, enlace, opciones,
 * interruptor, fecha, medida, lista, fuente (colección/categoría/marca),
 * nota, extension (lo dibuja la página) y los compuestos estiloTexto,
 * tipografia, boton, fondo y espaciado.
 *  - opciones: cada opción puede llevar si(fuentes) (p. ej. "Redes" del pie
 *    solo si la página la dibuja)
 *  - lista: desde { datos, etiqueta, crear, clave, nota?(x), todas? } añade
 *    desde los datos de la tienda (todas: { etiqueta, filtro?(x) } = un botón
 *    para añadir todas las que faltan); plantilla: { etiqueta } = reemplazar
 *    la lista por la de una sección nueva (crearAjustes de la página)
 */

/* ── Piezas compartidas (mismos campos que los controles de hoy) ── */

export const FUENTES_TIPOGRAFIA = [
  { valor: '', texto: 'Por defecto' },
  { valor: "'Inter', sans-serif", texto: 'Inter' },
  { valor: "'Roboto', sans-serif", texto: 'Roboto' },
  { valor: "'Poppins', sans-serif", texto: 'Poppins' },
  { valor: "'Montserrat', sans-serif", texto: 'Montserrat' },
  { valor: "'Outfit', sans-serif", texto: 'Outfit' },
  { valor: "'Nunito', sans-serif", texto: 'Nunito' },
  { valor: "'Raleway', sans-serif", texto: 'Raleway' },
  { valor: "'Ubuntu', sans-serif", texto: 'Ubuntu' },
  { valor: "'Playfair Display', serif", texto: 'Playfair Display' },
  { valor: "'Merriweather', serif", texto: 'Merriweather' },
  { valor: "'Lora', serif", texto: 'Lora' },
  { valor: "'Oswald', sans-serif", texto: 'Oswald' },
];

const ALINEAR = [
  { valor: 'left', texto: 'Izquierda' },
  { valor: 'center', texto: 'Centro' },
  { valor: 'right', texto: 'Derecha' },
];

/** Alineación, subrayado, fondo y enlace de un texto (TextStyleControl). */
const estiloTexto = (prefijo, etiqueta) => ({ tipo: 'estiloTexto', prefijo, etiqueta, pestana: 'diseno' });
/** Fuente, tamaño, grosor y mayúsculas de un texto (TypographyControl). */
const tipografia = (prefijo, etiqueta) => ({ tipo: 'tipografia', prefijo, etiqueta, pestana: 'diseno' });
/** Botón opcional de la sección (buttonText + buttonLink). */
const boton = (conColores = false) => ({ tipo: 'boton', conColores });
/** Fondo de la sección (color, degradado, imagen, desenfoque, velo). */
const fondo = () => ({ tipo: 'fondo', pestana: 'avanzado' });
/** Relleno arriba y abajo. */
const espaciado = () => ({ tipo: 'espaciado', pestana: 'avanzado' });

const titulo = (etiqueta = 'Título de la sección', placeholder) => ({ tipo: 'texto', campo: 'title', etiqueta, placeholder });
/** Texto corto sobre el título; se dibuja en una etiqueta colgante (opcional). */
const etiquetaSuperior = () => ({ tipo: 'texto', campo: 'eyebrow', etiqueta: 'Etiqueta sobre el título', placeholder: 'Ej: Lo más pedido', ayuda: 'Opcional. Sale en una etiqueta colgante, como la del logo.' });

/** Lo que llevan casi todas las secciones con productos o tarjetas. */
const cabeceraSeccion = (etiqueta) => [etiquetaSuperior(), titulo(etiqueta), estiloTexto('title', 'Estilo del título'), boton()];
const pieComun = () => [fondo(), espaciado()];

const autoplay = (unidad = 'ms') => [
  { tipo: 'interruptor', campo: 'autoPlay', etiqueta: 'Avanzar solo', pestana: 'diseno' },
  unidad === 's'
    ? { tipo: 'numero', campo: 'autoPlaySpeed', etiqueta: 'Cambiar cada', sufijo: 's', escala: 1000, min: 2, max: 30, pestana: 'diseno', si: (a) => a.autoPlay !== false }
    : { tipo: 'numero', campo: 'autoPlaySpeed', etiqueta: 'Cambiar cada', sufijo: 's', escala: 1000, min: 1, max: 30, paso: 0.5, pestana: 'diseno', si: (a) => !!a.autoPlay },
];

const carruselProductos = (descripcion, extra = []) => ({
  grupo: 'Productos',
  descripcion,
  campos: [
    ...extra,
    ...cabeceraSeccion(),
    { tipo: 'numero', campo: 'visibleItems', etiqueta: 'Productos a la vista (escritorio)', min: 1, max: 8, pestana: 'diseno' },
    ...autoplay(),
    ...pieComun(),
  ],
});

/* ── Esquemas por tipo ── */

/** category_grid automático. Sin dataSource guardado cuenta como "a mano", igual que el editor de la tienda. */
const categoriasAuto = (a) => a.dataSource === 'products';

/*
 * Tamaños de un clic para las tres portadas (con foto, fotos que se pasan
 * solas y la de la marca): en cada tamaño miden lo mismo, así una debajo de
 * otra no se ven desparejas. Cada portada dice qué campos fija (campos(t)).
 *  - Como la portada de la marca: dentro del ancho de la página, esquinas redondas
 *  - Grande: igual, más alta
 *  - Pantalla completa: de borde a borde, casi todo el alto, sin esquinas
 */
const TAMANOS_PORTADA = [
  { valor: 'portada', texto: 'Como la portada de la marca', detalle: 'Dentro de la página, esquinas redondas', escritorio: '400px', movil: '440px', completo: false },
  { valor: 'grande', texto: 'Grande', detalle: 'Dentro de la página, más alta', escritorio: '560px', movil: '480px', completo: false },
  { valor: 'completa', texto: 'Pantalla completa', detalle: 'De borde a borde, casi todo el alto', escritorio: 'max(95vh, 600px)', movil: 'clamp(420px, 78vh, 640px)', completo: true },
];
const tamanosDePortada = (campos, porDefecto) => ({
  tipo: 'tamanos', etiqueta: 'Tamaño', ayuda: 'Las portadas miden lo mismo en cada tamaño.',
  opciones: TAMANOS_PORTADA.map((t) => ({ valor: t.valor, texto: t.texto, detalle: t.detalle, porDefecto: t.valor === porDefecto, valores: campos(t) })),
});

export const ESQUEMAS = {
  hero_banner: {
    nombre: 'Portada con foto', icono: Image, grupo: 'Portada',
    descripcion: 'Foto o video grande con título y botón.',
    campos: [
      { tipo: 'opciones', campo: 'mediaType', etiqueta: 'Fondo', opciones: [{ valor: 'image', texto: 'Imagen' }, { valor: 'gif', texto: 'GIF' }, { valor: 'video', texto: 'Video' }] },
      { tipo: 'imagen', campo: 'mediaUrl', etiqueta: 'Imagen o video', acepta: 'image/*,video/*', carpeta: 'storefront/hero-banner' },
      { tipo: 'imagen', campo: 'thumbnailUrl', etiqueta: 'Portada mientras carga el video', si: (a) => a.mediaType === 'video', carpeta: 'storefront/hero-banner' },
      tamanosDePortada((t) => ({ minHeight: t.escritorio, fullWidth: t.completo })),
      etiquetaSuperior(),
      titulo('Título'),
      { tipo: 'parrafo', campo: 'subtitle', etiqueta: 'Subtítulo', filas: 2 },
      { tipo: 'texto', campo: 'buttonText', etiqueta: 'Texto del botón' },
      { tipo: 'enlace', campo: 'buttonLink', etiqueta: 'Enlace del botón' },
      { tipo: 'opciones', campo: 'textAlign', etiqueta: 'Texto horizontal', opciones: ALINEAR, pestana: 'diseno' },
      { tipo: 'opciones', campo: 'textPosition', etiqueta: 'Texto vertical', opciones: [{ valor: 'flex-start', texto: 'Arriba' }, { valor: 'center', texto: 'Medio' }, { valor: 'flex-end', texto: 'Abajo' }], pestana: 'diseno' },
      { tipo: 'rango', campo: 'overlayOpacity', etiqueta: 'Oscurecer la foto', min: 0, max: 100, sufijo: '%', pestana: 'diseno' },
      { tipo: 'medida', campo: 'minHeight', etiqueta: 'Alto', sugerencias: ['400px', '500px', '600px', '100vh'], pestana: 'diseno' },
      { tipo: 'color', campo: 'titleColor', etiqueta: 'Color del título', pestana: 'diseno' },
      { tipo: 'color', campo: 'subtitleColor', etiqueta: 'Color del subtítulo', pestana: 'diseno' },
      { tipo: 'color', campo: 'buttonBgColor', etiqueta: 'Fondo del botón', pestana: 'diseno' },
      { tipo: 'color', campo: 'buttonTextColor', etiqueta: 'Texto del botón', pestana: 'diseno' },
      estiloTexto('title', 'Estilo del título'),
      estiloTexto('subtitle', 'Estilo del subtítulo'),
      tipografia('title', 'Letra del título'),
      tipografia('subtitle', 'Letra del subtítulo'),
    ],
    inicial: { mediaType: 'image', mediaUrl: '', title: 'Nueva colección', subtitle: 'Diseñada para destacar.', buttonText: 'Comprar ahora', buttonLink: '/tienda', textAlign: 'center', textPosition: 'center', overlayOpacity: 40, minHeight: '500px' },
  },

  // La portada de una marca: el nombre y el logo son los de Marcas; sus colores, aquí.
  brand_hero: {
    nombre: 'Portada de la marca', icono: Store, grupo: 'Portada',
    descripcion: 'El nombre y el logo de la marca de la página, con sus colores y su foto o un collage.',
    campos: [
      { tipo: 'nota', texto: 'Toma la marca de esta página: su nombre y su logo se cambian en Marcas. En una página sin marca no se ve.' },
      {
        tipo: 'opciones', campo: 'estilo', etiqueta: 'Estilo', porDefecto: 'color',
        ayuda: 'Foto: tu foto con el color detrás del texto. Color: el degradado con el logo grande. Collage: tres de sus productos.',
        opciones: [{ valor: 'foto', texto: 'Foto' }, { valor: 'color', texto: 'Color' }, { valor: 'collage', texto: 'Collage' }],
      },
      { tipo: 'imagen', campo: 'imagen', etiqueta: 'Foto de la portada', ayuda: 'Horizontal. Sin foto, sale la portada de color.', carpeta: 'brands/portadas', si: (a) => a.estilo === 'foto' },
      { tipo: 'nota', texto: 'Sin productos con foto, el collage sale como portada de color.', si: (a) => a.estilo === 'collage' },
      // "Como la portada de la marca" es su tamaño de siempre (sin alto guardado).
      tamanosDePortada((t) => (t.valor === 'portada' ? { alto: '', altoMovil: '', fullWidth: false } : { alto: t.escritorio, altoMovil: t.movil, fullWidth: t.completo }), 'portada'),
      { tipo: 'parrafo', campo: 'frase', etiqueta: 'Frase', filas: 2, ayuda: 'Una línea bajo el nombre. Vacía: "Productos de" y el nombre.' },
      { tipo: 'texto', campo: 'buttonText', etiqueta: 'Texto del botón', ayuda: 'Baja al catálogo de la página.' },
      { tipo: 'color', campo: 'color', etiqueta: 'Color de la marca', vacio: 'Violeta' },
      { tipo: 'color', campo: 'color2', etiqueta: 'Segundo color', vacio: 'Automático' },
      { tipo: 'nota', texto: 'El color pinta la portada; el segundo cierra su degradado (vacío: el primero oscurecido). De noche, si un color no se ve sobre el fondo oscuro, se aclara solo. Los botones de compra siguen violeta.' },
    ],
    inicial: { estilo: 'color', imagen: '', frase: '', buttonText: 'Ver productos', color: '', color2: '' },
  },

  hero_carousel: {
    nombre: 'Fotos que se pasan solas', icono: Images, grupo: 'Portada',
    descripcion: 'Varias fotos grandes que se pasan solas.',
    campos: [
      {
        tipo: 'lista', campo: 'slides', etiqueta: 'Diapositivas', titulo: (d, i) => d.title || `Diapositiva ${i + 1}`, miniatura: (d) => d.imageUrl,
        nuevo: () => ({ id: `slide_${Date.now()}`, imageUrl: '', mobileImageUrl: '', link: '', alt: '', title: '', subtitle: '', buttonText: '', buttonLink: '', contentPosition: 'left', verticalPosition: 'center', imagePosition: 'center center', titleColor: '#ffffff', subtitleColor: '#ffffff', buttonBgColor: '#ffffff', buttonTextColor: '#111827', overlayColor: '#111827', overlayOpacity: 20 }),
        campos: [
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Imagen (escritorio)', carpeta: 'storefront/hero-carousel' },
          { tipo: 'imagen', campo: 'mobileImageUrl', etiqueta: 'Imagen para celular', ayuda: 'Si la dejas vacía se usa la de escritorio.', carpeta: 'storefront/hero-carousel' },
          { tipo: 'texto', campo: 'title', etiqueta: 'Título' },
          { tipo: 'parrafo', campo: 'subtitle', etiqueta: 'Subtítulo', filas: 2 },
          { tipo: 'texto', campo: 'buttonText', etiqueta: 'Texto del botón', placeholder: 'Ej: Explorar Walá' },
          { tipo: 'enlace', campo: 'buttonLink', etiqueta: 'Enlace del botón' },
          { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace de toda la imagen', ayuda: 'Solo si no hay botón.' },
          { tipo: 'opciones', campo: 'contentPosition', etiqueta: 'Texto horizontal', opciones: ALINEAR },
          { tipo: 'opciones', campo: 'verticalPosition', etiqueta: 'Texto vertical', opciones: [{ valor: 'top', texto: 'Arriba' }, { valor: 'center', texto: 'Centro' }, { valor: 'bottom', texto: 'Abajo' }] },
          { tipo: 'opciones', campo: 'imagePosition', etiqueta: 'Encuadre', opciones: [{ valor: 'left center', texto: 'Izquierda' }, { valor: 'center center', texto: 'Centro' }, { valor: 'right center', texto: 'Derecha' }, { valor: 'center top', texto: 'Arriba' }, { valor: 'center bottom', texto: 'Abajo' }] },
          { tipo: 'color', campo: 'overlayColor', etiqueta: 'Color del velo' },
          { tipo: 'rango', campo: 'overlayOpacity', etiqueta: 'Velo', min: 0, max: 80, sufijo: '%' },
          { tipo: 'color', campo: 'titleColor', etiqueta: 'Color del título' },
          { tipo: 'color', campo: 'subtitleColor', etiqueta: 'Color del subtítulo' },
          { tipo: 'color', campo: 'buttonBgColor', etiqueta: 'Fondo del botón' },
          { tipo: 'color', campo: 'buttonTextColor', etiqueta: 'Texto del botón' },
          { tipo: 'texto', campo: 'alt', etiqueta: 'Descripción de la imagen', ayuda: 'La leen los lectores de pantalla y Google.' },
        ],
      },
      tamanosDePortada((t) => ({ heightDesktop: t.escritorio, heightMobile: t.movil, fullWidth: t.completo, borderRadius: t.completo ? '0' : '28px' })),
      { tipo: 'interruptor', campo: 'autoPlay', etiqueta: 'Avanzar solo', porDefecto: true, pestana: 'diseno' },
      { tipo: 'numero', campo: 'autoPlaySpeed', etiqueta: 'Cambiar cada', sufijo: 's', escala: 1000, min: 2, max: 30, paso: 0.5, pestana: 'diseno', si: (a) => a.autoPlay !== false },
      { tipo: 'interruptor', campo: 'pauseOnHover', etiqueta: 'Pausar con el ratón encima', porDefecto: true, pestana: 'diseno', si: (a) => a.autoPlay !== false },
      { tipo: 'interruptor', campo: 'showArrows', etiqueta: 'Flechas', porDefecto: true, pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'showDots', etiqueta: 'Puntos', porDefecto: true, pestana: 'diseno' },
      { tipo: 'medida', campo: 'heightDesktop', etiqueta: 'Alto en escritorio', sugerencias: ['380px', '450px', '520px'], pestana: 'diseno' },
      { tipo: 'medida', campo: 'heightMobile', etiqueta: 'Alto en celular', sugerencias: ['280px', '350px', '420px'], pestana: 'diseno' },
      { tipo: 'medida', campo: 'borderRadius', etiqueta: 'Esquinas', sugerencias: ['0', '12px', '16px', '24px'], pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'fullWidth', etiqueta: 'Todo el ancho de la ventana', pestana: 'diseno' },
      ...pieComun(),
    ],
    inicial: { slides: [], autoPlay: true, autoPlaySpeed: 5000, showArrows: true, showDots: true, heightDesktop: '450px', heightMobile: '350px', borderRadius: '16px' },
  },

  announcement_bar: {
    nombre: 'Avisos de arriba', icono: Megaphone, grupo: 'Portada',
    descripcion: 'Mensajes cortos arriba de todo.',
    campos: [
      {
        tipo: 'lista', campo: 'messages', etiqueta: 'Mensajes', titulo: (m, i) => m.text || `Mensaje ${i + 1}`,
        nuevo: () => ({ text: 'Nuevo anuncio', link: '' }),
        campos: [
          { tipo: 'texto', campo: 'text', etiqueta: 'Texto', ayuda: 'Si empieza con un emoji (⚡, 🎁…) se cambia solo por su ícono de Walá.' },
          { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace', ayuda: 'Con enlace aparece el botón "Ver".' },
          { tipo: 'icono', campo: 'icon', etiqueta: 'Ícono', ninguno: true },
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'O una imagen propia' },
          { tipo: 'opciones', campo: 'fontFamily', etiqueta: 'Letra', opciones: FUENTES_TIPOGRAFIA.slice(0, 1).concat(FUENTES_TIPOGRAFIA.filter((f) => /Inter|Outfit|Roboto|Montserrat/.test(f.texto))) },
          { tipo: 'medida', campo: 'fontSize', etiqueta: 'Tamaño', sugerencias: ['12px', '14px', '16px'] },
          { tipo: 'interruptor', campo: 'bold', etiqueta: 'Negrita' },
          { tipo: 'interruptor', campo: 'italic', etiqueta: 'Cursiva' },
          { tipo: 'interruptor', campo: 'underline', etiqueta: 'Subrayado' },
          { tipo: 'opciones', campo: 'textAlign', etiqueta: 'Alineación', opciones: [{ valor: '', texto: 'Auto' }, ...ALINEAR] },
          { tipo: 'color', campo: 'textBg', etiqueta: 'Fondo del texto', vacio: 'Sin fondo' },
        ],
      },
      { tipo: 'opciones', campo: 'animationType', etiqueta: 'Movimiento', opciones: [{ valor: 'fade', texto: 'Uno a la vez' }, { valor: 'scroll', texto: 'Cinta continua' }], pestana: 'diseno' },
      { tipo: 'numero', campo: 'speed', etiqueta: 'Cambiar cada', sufijo: 's', escala: 1000, min: 1, max: 30, pestana: 'diseno' },
      { tipo: 'opciones', campo: 'variant', etiqueta: 'Estilo', opciones: [{ valor: 'soft', texto: 'Suave' }, { valor: 'solid', texto: 'Sólido' }, { valor: 'dark', texto: 'Oscuro' }], pestana: 'diseno' },
      { tipo: 'opciones', campo: 'density', etiqueta: 'Altura', opciones: [{ valor: 'compact', texto: 'Compacta' }, { valor: 'comfortable', texto: 'Cómoda' }], pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'showAccent', etiqueta: 'Punto decorativo', porDefecto: true, pestana: 'diseno' },
      { tipo: 'color', campo: 'bgColor', etiqueta: 'Fondo', pestana: 'diseno' },
      { tipo: 'color', campo: 'textColor', etiqueta: 'Texto', pestana: 'diseno' },
    ],
    inicial: { messages: [{ text: '🚚 Envíos a todo el Perú', link: '' }], speed: 4000, bgColor: '#7c3aed', textColor: '#ffffff', animationType: 'fade' },
  },

  header: {
    nombre: 'Título de la página', icono: Heading, grupo: 'Contenido',
    descripcion: 'Un título grande con subtítulo y botón.',
    campos: [
      etiquetaSuperior(),
      titulo('Título'),
      { tipo: 'texto', campo: 'titleHighlight', etiqueta: 'Resaltar estas palabras', ayuda: 'Se pintan en otro color dentro del título.' },
      { tipo: 'parrafo', campo: 'subtitle', etiqueta: 'Subtítulo', filas: 2 },
      boton(),
      { tipo: 'opciones', campo: 'textAlign', etiqueta: 'Alineación', opciones: ALINEAR, pestana: 'diseno' },
      { tipo: 'color', campo: 'titleColor', etiqueta: 'Color del título', automatico: true, pestana: 'diseno' },
      { tipo: 'color', campo: 'titleHighlightColor', etiqueta: 'Color del resaltado', automatico: true, pestana: 'diseno', si: (a) => !!a.titleHighlight },
      { tipo: 'color', campo: 'subtitleColor', etiqueta: 'Color del subtítulo', automatico: true, pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'compact', etiqueta: 'Compacto', descripcion: 'Letra y espacios más chicos.', pestana: 'diseno' },
      estiloTexto('title', 'Estilo del título'),
      estiloTexto('subtitle', 'Estilo del subtítulo'),
      tipografia('title', 'Letra del título'),
      tipografia('subtitle', 'Letra del subtítulo'),
      ...pieComun(),
    ],
    inicial: { title: 'Nuestra tienda', subtitle: 'Explora nuestros productos.', textAlign: 'center', titleColor: '', subtitleColor: '', paddingTop: '3rem', paddingBottom: '2rem' },
  },

  text: {
    nombre: 'Texto', icono: Type, grupo: 'Contenido',
    descripcion: 'Un título y párrafos.',
    campos: [
      { tipo: 'texto', campo: 'heading', etiqueta: 'Título (opcional)' },
      { tipo: 'parrafo', campo: 'content', etiqueta: 'Párrafo', filas: 6 },
      boton(),
      { tipo: 'opciones', campo: 'textAlign', etiqueta: 'Alineación', opciones: [...ALINEAR, { valor: 'justify', texto: 'Justificado' }], pestana: 'diseno' },
      { tipo: 'medida', campo: 'maxWidth', etiqueta: 'Ancho máximo', sugerencias: ['600px', '800px', '100%'], pestana: 'diseno' },
      { tipo: 'color', campo: 'headingColor', etiqueta: 'Color del título', automatico: true, pestana: 'diseno' },
      { tipo: 'color', campo: 'textColor', etiqueta: 'Color del párrafo', automatico: true, pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'compact', etiqueta: 'Compacto', pestana: 'diseno' },
      estiloTexto('heading', 'Estilo del título'),
      estiloTexto('content', 'Estilo del párrafo'),
      tipografia('heading', 'Letra del título'),
      tipografia('content', 'Letra del párrafo'),
      ...pieComun(),
    ],
    inicial: { heading: '', content: '', textAlign: 'left', maxWidth: '800px', textColor: '', headingColor: '', paddingTop: '2rem', paddingBottom: '2rem' },
  },

  image: {
    nombre: 'Imagen', icono: Image, grupo: 'Contenido',
    descripcion: 'Una imagen, con enlace si quieres.',
    campos: [
      { tipo: 'imagen', campo: 'url', etiqueta: 'Imagen', carpeta: 'storefront/imagenes' },
      { tipo: 'texto', campo: 'alt', etiqueta: 'Descripción de la imagen', ayuda: 'La leen los lectores de pantalla y Google.' },
      { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace' },
      { tipo: 'opciones', campo: 'alignment', etiqueta: 'Alineación', opciones: ALINEAR, pestana: 'diseno' },
      { tipo: 'medida', campo: 'maxWidth', etiqueta: 'Ancho máximo', sugerencias: ['480px', '800px', '100%'], pestana: 'diseno' },
      { tipo: 'medida', campo: 'borderRadius', etiqueta: 'Esquinas', sugerencias: ['0px', '12px', '20px'], pestana: 'diseno' },
      ...pieComun(),
    ],
    inicial: { url: '', alt: '', link: '', maxWidth: '100%', alignment: 'center', borderRadius: '0px', paddingTop: '0rem', paddingBottom: '0rem' },
  },

  video: {
    nombre: 'Video', icono: Video, grupo: 'Contenido',
    descripcion: 'YouTube, Vimeo o un archivo MP4.',
    campos: [
      { tipo: 'enlace', campo: 'url', etiqueta: 'Enlace del video', placeholder: 'https://www.youtube.com/watch?v=…' },
      { tipo: 'imagen', campo: 'poster', etiqueta: 'Portada (solo MP4)', carpeta: 'storefront/videos' },
      { tipo: 'opciones', campo: 'aspectRatio', etiqueta: 'Formato', opciones: [{ valor: '16:9', texto: 'Horizontal' }, { valor: '9:16', texto: 'Vertical' }, { valor: '1:1', texto: 'Cuadrado' }, { valor: 'auto', texto: 'Original' }], pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'autoplay', etiqueta: 'Reproducir solo y en silencio', porDefecto: true, pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'loop', etiqueta: 'Repetir', porDefecto: true, pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'controls', etiqueta: 'Mostrar controles', pestana: 'diseno' },
      ...pieComun(),
    ],
    inicial: { url: '', poster: '', aspectRatio: '16:9', paddingTop: '0rem', paddingBottom: '0rem' },
  },

  featured_products: { nombre: 'Destacados (cuadrícula)', icono: Star, grupo: 'Productos', descripcion: 'Cuadrícula con los productos destacados.', campos: [...cabeceraSeccion(), ...pieComun()], inicial: { title: 'Productos destacados' } },
  featured_carousel: { nombre: 'Destacados (fila)', icono: Star, ...carruselProductos('Los productos destacados en una fila deslizable.'), inicial: { title: 'Productos destacados', visibleItems: 5, autoPlay: false, autoPlaySpeed: 5000 } },
  new_arrivals_carousel: { nombre: 'Lo nuevo (fila)', icono: Sparkles, ...carruselProductos('Lo más reciente de la tienda.'), inicial: { title: 'Novedades', visibleItems: 5, autoPlay: false, autoPlaySpeed: 5000 } },
  sale_carousel: { nombre: 'Ofertas (fila)', icono: Tag, ...carruselProductos('Productos con descuento.'), inicial: { title: 'Ofertas', visibleItems: 5, autoPlay: false, autoPlaySpeed: 5000 } },
  category_carousel: {
    nombre: 'Productos de una categoría', icono: FolderOpen,
    ...carruselProductos('Productos de una categoría.', [{ tipo: 'fuente', campo: 'categoryId', etiqueta: 'Categoría', datos: 'categorias', vacio: 'Elige una categoría' }]),
    inicial: { title: '', categoryId: '', visibleItems: 5, autoPlay: false, autoPlaySpeed: 5000 },
  },
  collection_carousel: {
    nombre: 'Productos de una colección', icono: Layers, grupo: 'Productos', descripcion: 'Los productos de una colección en una fila.',
    campos: [{ tipo: 'fuente', campo: 'collection', etiqueta: 'Colección', datos: 'colecciones', vacio: 'Elige una colección' }, ...cabeceraSeccion(), ...pieComun()],
    inicial: { title: '', collection: '' },
  },
  flash_sales: {
    nombre: 'Ofertas relámpago', icono: Zap, grupo: 'Productos', descripcion: 'Productos de una colección con cuenta regresiva.',
    campos: [
      { tipo: 'fuente', campo: 'collection', etiqueta: 'Colección', datos: 'colecciones', vacio: 'Elige una colección' },
      { tipo: 'fecha', campo: 'endTime', etiqueta: 'Termina el' },
      ...cabeceraSeccion(),
      { tipo: 'texto', campo: 'subtitle', etiqueta: 'Subtítulo', placeholder: 'Ej: Precios que se van a medianoche' },
      ...pieComun(),
    ],
    inicial: () => ({ title: 'Ofertas relámpago', collection: '', endTime: new Date(Date.now() + 86400000).toISOString() }),
  },
  bestsellers_row: {
    nombre: 'Tarjetas con foto y enlace', icono: Trophy, grupo: 'Contenido', descripcion: 'Hasta 5 tarjetas que armas a mano: foto, texto y a dónde llevan.',
    campos: [
      titulo('Título (opcional)'),
      {
        tipo: 'lista', campo: 'cards', etiqueta: 'Tarjetas', max: 5, titulo: (c, i) => c.title || `Tarjeta ${i + 1}`, miniatura: (c) => c.imageUrl,
        nuevo: () => ({ id: `card_${Date.now()}`, title: 'Nueva tarjeta', subtitle: '', imageUrl: '', link: '' }),
        campos: [
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Foto', carpeta: 'storefront/destacados' },
          { tipo: 'texto', campo: 'title', etiqueta: 'Título' },
          { tipo: 'texto', campo: 'subtitle', etiqueta: 'Descripción breve' },
          { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace' },
          { tipo: 'opciones', campo: 'titleAlign', etiqueta: 'Alinear título', opciones: [{ valor: '', texto: 'Auto' }, ...ALINEAR] },
          { tipo: 'opciones', campo: 'subtitleAlign', etiqueta: 'Alinear descripción', opciones: [{ valor: '', texto: 'Auto' }, ...ALINEAR] },
        ],
      },
      ...pieComun(),
    ],
    inicial: { cards: [] },
  },
  product_grid: {
    nombre: 'Todos los productos', icono: Grid3x3, grupo: 'Productos', descripcion: 'Todos los productos, de a poco al bajar.',
    campos: [{ tipo: 'fuente', campo: 'brandId', etiqueta: 'Marca', datos: 'marcas', vacio: 'Todas las marcas' }, ...cabeceraSeccion(), ...pieComun()],
    inicial: { title: '', show_search: true, brandId: '' },
  },
  sidebar_catalog: {
    nombre: 'Todos los productos con filtros', icono: Store, grupo: 'Productos', descripcion: 'Productos con filtros por categoría, precio y más.', porMarca: true,
    campos: [{ tipo: 'fuente', campo: 'brandId', etiqueta: 'Marca', datos: 'marcas', vacio: 'Todas las marcas' }, ...cabeceraSeccion('Título (opcional)'), ...pieComun()],
    inicial: { title: 'Catálogo completo', brandId: '' },
  },

  category_grid: {
    nombre: 'Categorías con foto', icono: LayoutGrid, grupo: 'Navegación', descripcion: '¿Qué estás buscando? con fotos.',
    campos: [
      { tipo: 'opciones', campo: 'dataSource', etiqueta: 'Contenido', porDefecto: 'manual', opciones: [{ valor: 'products', texto: 'Automático' }, { valor: 'manual', texto: 'A mano' }] },
      { tipo: 'nota', texto: 'Se arma sola con las categorías que tienen productos.', si: categoriasAuto },
      titulo(),
      estiloTexto('title', 'Estilo del título'),
      { tipo: 'numero', campo: 'limit', etiqueta: 'Máximo de categorías', min: 2, max: 12, si: categoriasAuto },
      { tipo: 'opciones', campo: 'imageSource', etiqueta: 'Foto', opciones: [{ valor: 'product', texto: 'De un producto' }, { valor: 'category', texto: 'De la categoría' }], si: categoriasAuto },
      { tipo: 'opciones', campo: 'sortMode', etiqueta: 'Orden', opciones: [{ valor: 'admin', texto: 'El de administración' }, { valor: 'products', texto: 'Más productos primero' }, { valor: 'alphabetical', texto: 'Alfabético' }], si: categoriasAuto },
      {
        tipo: 'lista', campo: 'items', etiqueta: 'Categorías', si: (a) => !categoriasAuto(a), titulo: (c) => c.name || 'Categoría', miniatura: (c) => c.imageUrl,
        desde: { datos: 'categorias', etiqueta: 'Añadir una categoría', crear: (c) => ({ categoryId: c.id, name: c.name || '', imageUrl: c.imageUrl || '' }), clave: 'categoryId', nota: (c) => (c.imageUrl ? '' : 'sin foto'), todas: { etiqueta: 'Añadir todas las categorías' } },
        nuevo: () => ({ categoryId: '', name: 'Nueva categoría', imageUrl: '' }),
        campos: [
          { tipo: 'texto', campo: 'name', etiqueta: 'Nombre a mostrar' },
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Foto' },
          { tipo: 'color', campo: 'backgroundColor', etiqueta: 'Color del cuadro', automatico: true, vacio: 'El general' },
        ],
      },
      { tipo: 'numero', campo: 'columns', etiqueta: 'Columnas (escritorio)', min: 2, max: 6, pestana: 'diseno' },
      { tipo: 'opciones', campo: 'cardStyle', etiqueta: 'Forma', opciones: [{ valor: 'compact', texto: 'Cuadros' }, { valor: 'round', texto: 'Círculos' }], pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'showProductCount', etiqueta: 'Mostrar cuántos productos hay', pestana: 'diseno', si: categoriasAuto },
      { tipo: 'color', campo: 'tileBackgroundColor', etiqueta: 'Color de los cuadros', automatico: true, pestana: 'diseno' },
      ...pieComun(),
    ],
    inicial: { title: '¿Qué estás buscando?', dataSource: 'products', imageSource: 'product', items: [], columns: 6, limit: 6, sortMode: 'admin', cardStyle: 'compact', paddingTop: '0.75rem', paddingBottom: '0.75rem' },
  },
  categories_nav: {
    nombre: 'Botones de categorías', icono: Navigation, grupo: 'Navegación', descripcion: 'Burbujas redondas que filtran los productos de la página.', porMarca: true,
    campos: [
      { tipo: 'fuente', campo: 'brandId', etiqueta: 'Marca', datos: 'marcas', vacio: 'Sin marca' },
      { tipo: 'nota', texto: 'Elige una marca: las burbujas salen de su configuración.', si: (a) => !a.brandId },
      { tipo: 'extension', nombre: 'burbujasDeMarca', si: (a) => !!a.brandId },
    ],
    inicial: { brandId: '' },
  },
  banner_grid: {
    nombre: 'Tarjetas de marcas o banners', icono: Rows3, grupo: 'Navegación', descripcion: 'Tarjetas de cada marca o banners a mano.',
    campos: [
      { tipo: 'opciones', campo: 'dataSource', etiqueta: 'Contenido', porDefecto: 'manual', opciones: [{ valor: 'brands', texto: 'Marcas (automático)' }, { valor: 'manual', texto: 'Banners a mano' }] },
      titulo(),
      { tipo: 'texto', campo: 'subtitle', etiqueta: 'Subtítulo' },
      {
        tipo: 'lista', campo: 'items', etiqueta: 'Banners', si: (a) => a.dataSource !== 'brands', titulo: (b, i) => b.alt || `Banner ${i + 1}`, miniatura: (b) => b.imageUrl,
        nuevo: () => ({ imageUrl: '', link: '', alt: '' }),
        campos: [
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Imagen', carpeta: 'storefront/banners' },
          { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace' },
          { tipo: 'texto', campo: 'alt', etiqueta: 'Descripción de la imagen' },
        ],
      },
      { tipo: 'numero', campo: 'columns', etiqueta: 'Columnas (escritorio)', min: 1, max: 4, pestana: 'diseno' },
      { tipo: 'opciones', campo: 'brandCardStyle', etiqueta: 'Tarjetas', opciones: [{ valor: 'editorial', texto: 'De color' }, { valor: 'uniform', texto: 'Uniformes' }, { valor: 'outline', texto: 'Con borde' }], pestana: 'diseno', si: (a) => a.dataSource === 'brands' },
      { tipo: 'interruptor', campo: 'showBrandName', etiqueta: 'Mostrar el nombre de la marca', porDefecto: true, pestana: 'diseno', si: (a) => a.dataSource === 'brands' },
      { tipo: 'interruptor', campo: 'autoPlay', etiqueta: 'Avanzar solo', porDefecto: true, pestana: 'diseno', si: (a) => a.dataSource === 'brands' },
      { tipo: 'numero', campo: 'autoPlaySpeed', etiqueta: 'Cambiar cada', sufijo: 's', escala: 1000, min: 2, max: 30, pestana: 'diseno', si: (a) => a.dataSource === 'brands' && a.autoPlay !== false },
      ...pieComun(),
    ],
    inicial: { dataSource: 'brands', title: 'Explora nuestros mundos', subtitle: 'Encuentra productos de tus marcas favoritas', showBrandName: true, brandCardStyle: 'editorial', items: [], columns: 3, autoPlay: true, autoPlaySpeed: 6000, gap: '1rem' },
  },

  trust_badges: {
    nombre: 'Garantías', icono: ShieldCheck, grupo: 'Confianza', descripcion: 'Envío, pago seguro, cambios…',
    campos: [
      {
        tipo: 'lista', campo: 'badges', etiqueta: 'Insignias', titulo: (b, i) => b.text || `Insignia ${i + 1}`,
        nuevo: () => ({ icon: 'check', text: 'Nueva insignia' }),
        campos: [
          { tipo: 'texto', campo: 'text', etiqueta: 'Texto corto' },
          { tipo: 'icono', campo: 'icon', etiqueta: 'Ícono' },
        ],
      },
      ...pieComun(),
    ],
    inicial: { badges: [{ icon: 'truck', text: 'Envío rápido' }, { icon: 'shield', text: 'Pago seguro' }] },
  },
  testimonials: {
    nombre: 'Opiniones de clientes', icono: MessageSquareQuote, grupo: 'Confianza', descripcion: 'Opiniones reales de clientes.',
    campos: [
      ...cabeceraSeccion(),
      {
        tipo: 'lista', campo: 'testimonials', etiqueta: 'Opiniones', titulo: (t, i) => t.author || `Opinión ${i + 1}`, miniatura: (t) => t.avatar,
        nuevo: () => ({ topic: '', author: 'Cliente de Walá', city: '', avatar: '', text: 'Escribe aquí una opinión real.', rating: 5, verified: false }),
        campos: [
          { tipo: 'parrafo', campo: 'text', etiqueta: 'Opinión', filas: 3 },
          { tipo: 'texto', campo: 'author', etiqueta: 'Nombre del cliente' },
          { tipo: 'texto', campo: 'city', etiqueta: 'Ciudad', placeholder: 'Ej. Lima' },
          { tipo: 'texto', campo: 'topic', etiqueta: 'Tema', placeholder: 'Ej. Calidad de impresión' },
          { tipo: 'rango', campo: 'rating', etiqueta: 'Estrellas', min: 1, max: 5, sufijo: '★' },
          { tipo: 'imagen', campo: 'avatar', etiqueta: 'Foto del cliente', ayuda: 'Sin foto se muestra su inicial.' },
          { tipo: 'interruptor', campo: 'verified', etiqueta: 'Compra verificada' },
        ],
      },
      ...pieComun(),
    ],
    inicial: { title: 'Lo que dicen nuestros clientes', testimonials: [] },
  },
  marquee: {
    nombre: 'Cinta de logos', icono: Cinta, grupo: 'Confianza', descripcion: 'Marcas o aliados en una cinta sin fin.',
    campos: [
      ...cabeceraSeccion('Título (opcional)'),
      {
        tipo: 'lista', campo: 'items', etiqueta: 'Logos', titulo: (m, i) => m.name || `Logo ${i + 1}`, miniatura: (m) => m.imageUrl,
        desde: {
          datos: 'marcas', etiqueta: 'Añadir una marca de la tienda', clave: 'brandId',
          crear: (b) => ({ name: b.name || '', imageUrl: b.logoUrl || b.imageUrl || '', link: b.slug ? `/${b.slug}` : '', shape: 'circle', zoom: 1, posX: 50, posY: 50, brandId: b.id }),
          nota: (b) => (b.logoUrl || b.imageUrl ? '' : 'sin logo'),
          todas: { etiqueta: 'Añadir todas las marcas con logo', filtro: (b) => Boolean(b.logoUrl || b.imageUrl) },
        },
        nuevo: () => ({ name: 'Nueva marca', imageUrl: '', link: '', shape: 'circle', zoom: 1, posX: 50, posY: 50 }),
        campos: [
          { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Logo', carpeta: 'storefront/brands' },
          { tipo: 'texto', campo: 'name', etiqueta: 'Nombre' },
          { tipo: 'enlace', campo: 'link', etiqueta: 'Enlace' },
          { tipo: 'opciones', campo: 'shape', etiqueta: 'Marco', opciones: [{ valor: 'circle', texto: 'Círculo' }, { valor: 'square', texto: 'Cuadrado' }, { valor: 'star', texto: 'Estrella' }, { valor: 'pentagon', texto: 'Pentágono' }] },
          { tipo: 'rango', campo: 'zoom', etiqueta: 'Zoom', min: 1, max: 3, paso: 0.05, sufijo: '×' },
          { tipo: 'rango', campo: 'posX', etiqueta: 'Mover a los lados', min: 0, max: 100, sufijo: '%' },
          { tipo: 'rango', campo: 'posY', etiqueta: 'Mover arriba o abajo', min: 0, max: 100, sufijo: '%' },
        ],
      },
      { tipo: 'numero', campo: 'speed', etiqueta: 'Una vuelta cada', sufijo: 's', escala: 1000, min: 5, max: 120, pestana: 'diseno' },
      ...pieComun(),
    ],
    inicial: { items: [], speed: 20000 },
  },

  feature_list: {
    nombre: 'Beneficios', icono: ListChecks, grupo: 'Contenido', descripcion: 'Por qué elegirnos, en puntos.',
    campos: [
      etiquetaSuperior(),
      titulo('Título'),
      { tipo: 'texto', campo: 'subtitle', etiqueta: 'Subtítulo' },
      {
        tipo: 'lista', campo: 'items', etiqueta: 'Beneficios', titulo: (b, i) => b.text || `Beneficio ${i + 1}`,
        nuevo: () => ({ icon: 'check', text: 'Nuevo beneficio' }),
        campos: [
          { tipo: 'texto', campo: 'text', etiqueta: 'Texto' },
          { tipo: 'icono', campo: 'icon', etiqueta: 'Ícono' },
        ],
      },
      { tipo: 'imagen', campo: 'imageUrl', etiqueta: 'Foto (opcional)' },
      { tipo: 'texto', campo: 'imageAlt', etiqueta: 'Descripción de la foto', si: (a) => !!a.imageUrl },
      { tipo: 'parrafo', campo: 'quote', etiqueta: 'Cita (opcional)', filas: 2 },
      { tipo: 'texto', campo: 'quoteAuthor', etiqueta: 'Autor de la cita', si: (a) => !!a.quote },
      ...pieComun(),
    ],
    inicial: { title: '¿Por qué elegirnos?', items: [{ icon: '✓', text: 'Calidad premium a precio justo' }, { icon: '✓', text: 'Envío rápido a todo el Perú' }], paddingTop: '1rem', paddingBottom: '1rem' },
  },
  faq_accordion: {
    nombre: 'Preguntas frecuentes', icono: CircleHelp, grupo: 'Contenido', descripcion: 'Dudas comunes en un acordeón.',
    campos: [
      etiquetaSuperior(),
      titulo(),
      { tipo: 'texto', campo: 'subtitle', etiqueta: 'Texto de apoyo' },
      {
        tipo: 'lista', campo: 'items', etiqueta: 'Preguntas', titulo: (q, i) => q.question || `Pregunta ${i + 1}`,
        nuevo: () => ({ id: `faq_${Date.now()}`, question: 'Nueva pregunta', answer: '' }),
        plantilla: { etiqueta: 'Usar las preguntas recomendadas' },
        campos: [
          { tipo: 'texto', campo: 'question', etiqueta: 'Pregunta' },
          { tipo: 'parrafo', campo: 'answer', etiqueta: 'Respuesta', filas: 4 },
        ],
      },
      { tipo: 'opciones', campo: 'layout', etiqueta: 'En escritorio', opciones: [{ valor: 'split', texto: 'Título al lado' }, { valor: 'top', texto: 'Título arriba' }], pestana: 'diseno' },
      { tipo: 'interruptor', campo: 'defaultOpen', etiqueta: 'Primera pregunta abierta', pestana: 'diseno' },
      estiloTexto('title', 'Estilo del título'),
      ...pieComun(),
    ],
    inicial: { title: 'Preguntas frecuentes', subtitle: '', items: [], layout: 'split', defaultOpen: false, paddingTop: '1rem', paddingBottom: '1rem' },
  },
  map_location: {
    nombre: 'Mapa', icono: MapPin, grupo: 'Contenido', descripcion: 'Mapa de Google con dirección.',
    campos: [
      { tipo: 'parrafo', campo: 'embedUrl', etiqueta: 'Mapa de Google', filas: 3, ayuda: 'En Google Maps: Compartir → Insertar un mapa → copia el código o el enlace.' },
      titulo('Título'),
      { tipo: 'parrafo', campo: 'description', etiqueta: 'Dirección u horario', filas: 3 },
      boton(),
      { tipo: 'opciones', campo: 'layout', etiqueta: 'Mapa', opciones: [{ valor: 'mapRight', texto: 'Derecha' }, { valor: 'mapLeft', texto: 'Izquierda' }, { valor: 'mapTop', texto: 'Arriba' }, { valor: 'mapBottom', texto: 'Abajo' }], pestana: 'diseno' },
      { tipo: 'medida', campo: 'mapWidth', etiqueta: 'Ancho del mapa', sugerencias: ['40%', '50%', '60%'], pestana: 'diseno', si: (a) => !['mapTop', 'mapBottom'].includes(a.layout) },
      { tipo: 'medida', campo: 'mapHeight', etiqueta: 'Alto del mapa', sugerencias: ['300px', '400px', '500px'], pestana: 'diseno' },
      estiloTexto('title', 'Estilo del título'),
      estiloTexto('description', 'Estilo de la descripción'),
      ...pieComun(),
    ],
    inicial: { title: 'Encuéntranos', description: 'Visita nuestra tienda de lunes a viernes de 9 a. m. a 6 p. m.', embedUrl: '', layout: 'mapRight', mapWidth: '50%', mapHeight: '400px' },
  },

  footer_columns: {
    nombre: 'Pie de página', icono: PanelBottom, grupo: 'Pie', descripcion: 'Columnas con texto, enlaces o redes.',
    campos: [
      {
        tipo: 'lista', campo: 'columns', etiqueta: 'Columnas', titulo: (c, i) => c.title || `Columna ${i + 1}`,
        nuevo: () => ({ id: `col_${Date.now()}`, title: 'Nueva columna', type: 'text', content: '' }),
        campos: [
          { tipo: 'texto', campo: 'title', etiqueta: 'Título' },
          { tipo: 'opciones', campo: 'type', etiqueta: 'Tipo', opciones: [{ valor: 'text', texto: 'Texto' }, { valor: 'links', texto: 'Enlaces' }, { valor: 'social', texto: 'Redes', si: (f) => f.pieConRedes !== false }] },
          { tipo: 'parrafo', campo: 'content', etiqueta: 'Texto', filas: 3, si: (c) => (c.type || 'text') === 'text' },
          {
            tipo: 'lista', campo: 'links', etiqueta: 'Enlaces', si: (c) => c.type === 'links' || c.type === 'social', titulo: (l, i) => l.text || l.url || `Enlace ${i + 1}`,
            nuevo: () => ({ text: 'Nuevo enlace', url: '/' }),
            campos: [
              { tipo: 'texto', campo: 'text', etiqueta: 'Texto' },
              { tipo: 'enlace', campo: 'url', etiqueta: 'Enlace' },
              { tipo: 'color', campo: 'color', etiqueta: 'Color', automatico: true },
              { tipo: 'interruptor', campo: 'bold', etiqueta: 'Negrita' },
            ],
          },
        ],
      },
    ],
    inicial: { columns: [] },
  },
};

/*
 * Lo que no es una sección de la página pero se edita desde el mismo panel
 * (en la tienda: storeConfig/homePage). Cada uno guarda en su propio objeto,
 * con los mismos nombres que el editor de antes.
 */
export const ESQUEMAS_GLOBALES = {
  header: {
    nombre: 'Menú de la cabecera', icono: Menu, descripcion: 'Los enlaces de arriba, en todas las páginas.',
    campos: [
      {
        tipo: 'lista', campo: 'navLinks', etiqueta: 'Enlaces', titulo: (l, i) => l.text || `Enlace ${i + 1}`,
        nuevo: () => ({ id: String(Date.now()), text: 'Nuevo enlace', type: 'link', url: '/' }),
        campos: [
          { tipo: 'texto', campo: 'text', etiqueta: 'Texto' },
          { tipo: 'opciones', campo: 'type', etiqueta: 'Al tocarlo', opciones: [{ valor: 'link', texto: 'Va a una página' }, { valor: 'dropdown', texto: 'Abre un menú' }] },
          { tipo: 'enlace', campo: 'url', etiqueta: 'Enlace' },
          { tipo: 'interruptor', campo: 'isCategoryAuto', etiqueta: 'Con las categorías de la tienda', descripcion: 'Solo las que tienen productos.', si: (l) => l.type === 'dropdown' && !l.isBrandAuto },
          { tipo: 'interruptor', campo: 'isBrandAuto', etiqueta: 'Con las marcas de la tienda', si: (l) => l.type === 'dropdown' && !l.isCategoryAuto },
          { tipo: 'fuente', campo: 'autoCollectionId', etiqueta: 'O las categorías de una colección', datos: 'colecciones', vacio: 'Enlaces a mano', si: (l) => l.type === 'dropdown' && !l.isCategoryAuto && !l.isBrandAuto },
          {
            tipo: 'lista', campo: 'dropdownLinks', etiqueta: 'Enlaces del menú', titulo: (d, i) => d.text || `Enlace ${i + 1}`,
            si: (l) => l.type === 'dropdown' && !l.isCategoryAuto && !l.isBrandAuto && !l.autoCollectionId,
            nuevo: () => ({ id: String(Date.now()), text: 'Nuevo', url: '/' }),
            campos: [
              { tipo: 'texto', campo: 'text', etiqueta: 'Texto' },
              { tipo: 'enlace', campo: 'url', etiqueta: 'Enlace' },
            ],
          },
        ],
      },
      { tipo: 'nota', texto: '"Minijuegos" se suma solo al final. Todos los enlaces llevan la letra y el violeta de la marca.' },
    ],
  },
  accountPopup: {
    nombre: 'Menú de cuenta', icono: UserRound, descripcion: 'Lo que ve quien aún no entra.',
    campos: [
      { tipo: 'texto', campo: 'title', etiqueta: 'Título', placeholder: 'Tu cuenta Walá' },
      { tipo: 'parrafo', campo: 'description', etiqueta: 'Texto', filas: 2 },
      { tipo: 'texto', campo: 'loginButtonText', etiqueta: 'Botón para entrar', placeholder: 'Iniciar sesión' },
      { tipo: 'enlace', campo: 'loginButtonUrl', etiqueta: 'Enlace para entrar', placeholder: '/login' },
      { tipo: 'texto', campo: 'registerButtonText', etiqueta: 'Botón para crear la cuenta', placeholder: 'Crear cuenta' },
      { tipo: 'enlace', campo: 'registerButtonUrl', etiqueta: 'Enlace para crear la cuenta', placeholder: '/registro' },
    ],
  },
  favoritesPopup: {
    nombre: 'Menú de favoritos', icono: Heart, descripcion: 'El corazón de la cabecera.',
    campos: [
      { tipo: 'texto', campo: 'loggedOutTitle', etiqueta: 'Título sin sesión', placeholder: 'Tus favoritos' },
      { tipo: 'parrafo', campo: 'loggedOutText', etiqueta: 'Texto sin sesión', filas: 2 },
      { tipo: 'texto', campo: 'loggedInTitle', etiqueta: 'Título con sesión y sin favoritos', placeholder: 'Aún no tienes favoritos' },
      { tipo: 'parrafo', campo: 'loggedInText', etiqueta: 'Texto con sesión y sin favoritos', filas: 2 },
      { tipo: 'texto', campo: 'buttonText', etiqueta: 'Texto del botón', placeholder: 'Mira lo que te puede interesar' },
      { tipo: 'enlace', campo: 'buttonLink', etiqueta: 'Enlace del botón', placeholder: '/tienda' },
    ],
  },
  searchPage: {
    nombre: 'Página de búsqueda', icono: Search, descripcion: 'Los textos de /buscar. Los resultados los decide el catálogo.',
    campos: [
      { tipo: 'texto', campo: 'titulo', etiqueta: 'Título', placeholder: 'Buscar productos' },
      { tipo: 'texto', campo: 'subtitulo', etiqueta: 'Frase de apoyo', ayuda: 'Cuando aún no se buscó nada.' },
      { tipo: 'texto', campo: 'marcador', etiqueta: 'Texto guía dentro del campo' },
      { tipo: 'texto', campo: 'boton', etiqueta: 'Texto del botón' },
      { tipo: 'texto', campo: 'vacioTitulo', etiqueta: 'Sin resultados: título' },
      { tipo: 'parrafo', campo: 'vacioTexto', etiqueta: 'Sin resultados: mensaje', filas: 2 },
      { tipo: 'parrafo', campo: 'vacioConFiltros', etiqueta: 'Sin resultados con filtros: mensaje', filas: 2 },
    ],
  },
};

/** Orden y nombre de los grupos del catálogo de módulos. */
export const GRUPOS_MODULOS = ['Portada', 'Productos', 'Navegación', 'Contenido', 'Confianza', 'Pie'];

/** Esquema de un tipo; los que el kit no conoce se muestran igual en la lista. */
export function esquemaDe(tipo) {
  return ESQUEMAS[tipo] || { nombre: tipo, icono: Clock, grupo: 'Otros', descripcion: 'Este módulo tiene su propio editor.', campos: [], desconocido: true };
}

/** Ajustes de una sección nueva (la tienda pasa getDefaultSettings en su lugar). */
export function ajustesIniciales(tipo) {
  const i = ESQUEMAS[tipo]?.inicial;
  return typeof i === 'function' ? i() : JSON.parse(JSON.stringify(i || {}));
}

/** Texto corto para reconocer una sección en la lista. */
export function resumenDe(seccion) {
  const a = seccion?.settings || {};
  return a.title || a.heading || a.slides?.[0]?.title || a.messages?.[0]?.text || a.url || '';
}
