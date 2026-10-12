import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from 'framer-motion';
import {
  ArrowRight, Bell, BellRing, CheckCircle2, Heart, Mail, Moon, Phone, Plus, RotateCcw, Search, ShoppingBag, Sparkles, Sun, Trash2, Wand2, User,
  UserRound, Package, Settings, Gift, Ticket, Palette,
} from 'lucide-react';
import {
  Boton, Etiqueta, Chip, CostoMonedas, GananciaMonedas, SaldoMonedas,
  Campo, SelectorTalla, SelectorColor, Cantidad, Interruptor,
  TarjetaProducto, TarjetaProductoEsqueleto,
  Cabecera, BarraInferior, Pestanas, Logo,
  SeguimientoPedido, ItemCarrito, BarraEnvioGratis, ResumenPedido,
  Aviso, ProveedorToasts, useToast, useNotificaciones, ListaNotificaciones, EstadoVacio, HojaInferior, soles,
  EASE, RESORTE, Revelar, Contador,
  ProveedorEnlaces, MenuTienda, AyudaMonedas, MenuCuenta, VistaFavoritos, VistaCarrito, AgregarRapido,
  accionDeProducto, tarjetaDesdeProducto, opcionesDeProducto, RenderSecciones,
} from './kit';
import s from './ComponentesPage.module.css';
import DemoEditor from './DemoEditor';
// La mayoría de productos reales vienen con fondo blanco: estas fotos lo simulan.
import FRENTE_BLANCO from './demo/polera-fondo-blanco.jpg';
import ESPALDA_BLANCO from './demo/polera-fondo-blanco-espalda.jpg';
import TAZA from './demo/taza.svg';
import CUADRO from './demo/cuadro.svg';

const FRENTE = '/prendas/hoodie-frente.webp';
const ESPALDA = '/prendas/hoodie-espalda.webp';
const MONEDA = '/assets/monedas/moneda-160.webp';
const META_ENVIO = 150;

const SECCIONES = [
  ['base', 'Base'],
  ['botones', 'Botones'],
  ['etiquetas', 'Etiquetas'],
  ['formularios', 'Formularios'],
  ['productos', 'Productos'],
  ['navegacion', 'Navegación'],
  ['menus', 'Menús'],
  ['builder', 'Builder'],
  ['editor', 'Editor'],
  ['carrito', 'Carrito'],
  ['pedidos', 'Pedidos'],
  ['avisos', 'Avisos'],
];

/*
 * Productos de ejemplo con la misma forma que la colección productos_wala
 * (ver normalizeProductForRead en src/services/products.js). Se pasan por
 * los adaptadores del kit, igual que se haría en la tienda.
 */
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRODUCTOS_DEMO = [
  {
    id: 'essentials', name: 'Polera Walá Essentials con capucha', price: 129.9, salePrice: 89.9, inStock: 24,
    mainImage: FRENTE_BLANCO, hasVariants: true,
    variants: [
      { id: 'negro', name: 'Negro', colorHex: '#111827', imageUrl: FRENTE_BLANCO, sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'blanco', name: 'Blanco', colorHex: '#f8fafc', imageUrl: FRENTE_BLANCO, sizes: ['S', 'M', 'L'] },
      { id: 'lila', name: 'Lila', colorHex: '#c4b5fd', imageUrl: FRENTE_BLANCO, sizes: ['M', 'L'] },
    ],
  },
  {
    id: 'diseno', name: 'Polera con tu diseño en la espalda', price: 99.9, inStock: 12, customizable: true,
    mainImage: ESPALDA_BLANCO, hasVariants: true,
    variants: [
      { id: 'negro', name: 'Negro', colorHex: '#111827', sizes: TALLAS },
      { id: 'lila', name: 'Lila', colorHex: '#c4b5fd', sizes: TALLAS },
    ],
  },
  {
    // Sin opciones (una sola variante "Principal" sin medidas): se agrega directo.
    id: 'taza', name: 'Taza mágica «Feliz día»', price: 34.9, inStock: 40, mainImage: TAZA, hasVariants: true,
    variants: [{ id: 'v1', name: 'Principal', colorHex: '#cccccc', sizes: [] }],
  },
  {
    // Variantes de estilo sin color: se eligen por nombre ("Modelo").
    id: 'kapi', name: 'Peluche Kapi', price: 59.9, inStock: 18, mainImage: '/assets/kapi/kapi-happy.webp', hasVariants: true,
    variants: [
      { id: 'feliz', name: 'Feliz', imageUrl: '/assets/kapi/kapi-happy.webp', sizes: [] },
      { id: 'hambriento', name: 'Hambriento', imageUrl: '/assets/kapi/kapi-hungry.webp', sizes: [] },
      { id: 'triste', name: 'Tristón', imageUrl: '/assets/kapi/kapi-sad.webp', sizes: [] },
    ],
  },
  {
    // Medidas en vez de tallas (sizeLabel), y personalizable.
    id: 'cuadro', name: 'Cuadro «Nuestro lugar» con tu foto', price: 79.9, inStock: 9, customizable: true, mainImage: CUADRO, hasVariants: true,
    variants: [{ id: 'v1', name: 'Principal', sizeLabel: 'Medida', sizes: ['20×30 cm', '30×40 cm', '40×60 cm'] }],
  },
  {
    // Combo: un color por pieza y talla compartida.
    id: 'combo', name: 'Combo polera x2 · Él y Ella', price: 169.9, inStock: 6, isComboProduct: true, mainImage: FRENTE,
    comboItems: [{ productId: 'el', name: 'Polera Él' }, { productId: 'ella', name: 'Polera Ella' }],
  },
  {
    // Prenda base del estudio Crear: se diseña desde cero.
    id: 'lienzo', name: 'Polera para diseñar desde cero', price: 69.9, inStock: 30, esPrendaBase: true, mainImage: ESPALDA,
  },
  {
    id: 'oversize', name: 'Polera oversize edición limitada', price: 119.9, inStock: 0, mainImage: ESPALDA_BLANCO, hasVariants: true,
    variants: [{ id: 'negro', name: 'Negro', colorHex: '#111827', sizes: ['M', 'L'] }],
  },
];
// Piezas de los combos (la tienda las carga aparte en ProductDetail).
const SUBPRODUCTOS_DEMO = {
  el: { hasVariants: true, variants: [
    { name: 'Negro', colorHex: '#111827', sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Azul marino', colorHex: '#1e3a8a', sizes: ['S', 'M', 'L', 'XL'] },
  ] },
  ella: { hasVariants: true, variants: [
    { name: 'Negro', colorHex: '#111827', sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Rojo vino', colorHex: '#7f1d1d', sizes: ['XS', 'S', 'M', 'L'] },
  ] },
};
// Datos de tarjeta que no vienen del producto (categoría visible, reseñas reales, etiquetas).
const EXTRAS_DEMO = {
  essentials: { categoria: 'Poleras', imagenHover: ESPALDA_BLANCO, puntuacion: 4.8, resenas: 124, vendidos: '1,2 mil' },
  diseno: { categoria: 'Personalizable', imagenHover: FRENTE_BLANCO, puntuacion: 4.9, resenas: 58 },
  taza: { categoria: 'Tazas', nuevo: true },
  kapi: { categoria: 'Peluches', puntuacion: 5, resenas: 31 },
  cuadro: { categoria: 'Cuadros' },
  combo: { categoria: 'Parejas', colores: ['#111827', '#1e3a8a', '#7f1d1d'] },
  lienzo: { categoria: 'Crear' },
  oversize: { categoria: 'Poleras', puntuacion: 4.7, resenas: 33 },
};
const productoDemo = (id) => PRODUCTOS_DEMO.find((p) => p.id === id);

/*
 * Una página del builder tal como la guarda Firestore (pages/{pageId}):
 * [{ id, type, order, settings }]. Los settings usan los mismos campos que
 * getDefaultSettings (src/pages/Tienda/services/storefront.js).
 */
const SECCIONES_DEMO = [
  { id: 's1', type: 'announcement_bar', order: 0, settings: {
    messages: [
      { text: '🚚 Envío gratis desde S/ 150 a todo el Perú', link: '' },
      { text: '🎁 Usa WALA10 y ahorra S/ 10 en tu primera compra', link: '/tienda' },
      { text: '⚡ Ofertas relámpago solo por hoy', link: '#oferta-flash' },
    ],
    speed: 4000, bgColor: '#6d28d9', textColor: '#ffffff', animationType: 'fade',
  } },
  { id: 's2', type: 'hero_carousel', order: 1, settings: {
    slides: [
      { imageUrl: '/crear/banner-crear-1200.webp', mobileImageUrl: '/crear/banner-crear-movil.webp', title: 'Diseña tu polera en 2 minutos', subtitle: 'Sube tu foto, escribe tu frase y nosotros la estampamos.', buttonText: 'Empezar a crear', buttonLink: '/personalizar', contentPosition: 'left', verticalPosition: 'center', overlayColor: '#1e1b2e', overlayOpacity: 35, buttonBgColor: '#ffffff', buttonTextColor: '#4c1d95' },
      { imageUrl: '/assets/kapi/banners/ruleta.webp', title: 'Gira la ruleta de Kapi', subtitle: 'Gana monedas y cupones todos los días.', buttonText: 'Jugar', buttonLink: '/minijuegos', contentPosition: 'left', overlayOpacity: 25 },
    ],
    autoPlay: true, autoPlaySpeed: 6000, showArrows: true, showDots: true, heightDesktop: '380px', heightMobile: '300px', borderRadius: '20px', paddingTop: '1rem', paddingBottom: '0.5rem',
  } },
  { id: 's3', type: 'trust_badges', order: 2, settings: {
    badges: [{ icon: 'truck', text: 'Envío a todo el Perú' }, { icon: 'shield', text: 'Pago seguro' }, { icon: 'return', text: 'Cambios fáciles' }, { icon: 'heart', text: 'Hecho con amor' }],
    paddingTop: '1rem', paddingBottom: '1rem',
  } },
  { id: 's4', type: 'flash_sales', order: 3, settings: {
    title: 'Ofertas relámpago', collection: 'ofertas', endTime: new Date(Date.now() + 5 * 3600 * 1000 + 17 * 60 * 1000).toISOString(),
    anchorId: 'oferta-flash', paddingTop: '1.5rem', paddingBottom: '1.5rem',
  } },
  { id: 's5', type: 'category_grid', order: 4, settings: {
    title: '¿Qué estás buscando?', dataSource: 'manual', columns: 6, cardStyle: 'compact', paddingTop: '1rem', paddingBottom: '1rem',
    items: [
      { categoryId: 'poleras', name: 'Poleras', imageUrl: FRENTE_BLANCO },
      { categoryId: 'tazas', name: 'Tazas', imageUrl: TAZA },
      { categoryId: 'peluches', name: 'Peluches', imageUrl: '/assets/kapi/kapi-happy.webp' },
      { categoryId: 'cuadros', name: 'Cuadros', imageUrl: CUADRO },
      { categoryId: 'parejas', name: 'Para parejas', imageUrl: ESPALDA_BLANCO },
      { categoryId: 'crear', name: 'Crea la tuya', imageUrl: ESPALDA },
    ],
  } },
  { id: 's6', type: 'featured_carousel', order: 5, settings: {
    title: 'Lo más pedido', visibleItems: 4, autoPlay: false, buttonText: 'Ver todo', buttonLink: '/tienda', paddingTop: '1.5rem', paddingBottom: '1.5rem',
  } },
  { id: 's10', type: 'banner_grid', order: 5.5, settings: {
    dataSource: 'brands', title: 'Explora nuestros mundos', subtitle: 'Encuentra productos de tus marcas favoritas',
    showBrandName: true, brandCardStyle: 'editorial', columns: 3, autoPlay: true, autoPlaySpeed: 6000, gap: '1rem',
    paddingTop: '2rem', paddingBottom: '2rem',
  } },
  { id: 's11', type: 'bestsellers_row', order: 5.7, settings: {
    title: 'Los más regalados', paddingTop: '1rem', paddingBottom: '1.5rem',
    cards: [
      { id: 'card1', title: 'Polera con tu foto', subtitle: 'Estampado de alta duración', imageUrl: FRENTE_BLANCO, link: '/tienda?categoria=poleras' },
      { id: 'card2', title: 'Taza mágica', subtitle: 'Aparece el diseño con el calor', imageUrl: TAZA, link: '/tienda?categoria=tazas' },
      { id: 'card3', title: 'Kapi de peluche', subtitle: 'Suave y con lazo', imageUrl: '/assets/kapi/kapi-happy.webp', link: '/kapi' },
      { id: 'card4', title: 'Cuadro decorativo', subtitle: 'Tu foto en lienzo', imageUrl: CUADRO, link: '/tienda?categoria=cuadros' },
      { id: 'card5', title: 'Para parejas', subtitle: 'Diseños que combinan', imageUrl: ESPALDA_BLANCO, link: '/tienda?categoria=parejas' },
    ],
  } },
  { id: 's12', type: 'header', order: 6.2, settings: {
    title: 'Hecho en Perú, con amor', titleHighlight: 'con amor', subtitle: 'Cada pedido se estampa a mano en nuestro taller de Lima.',
    textAlign: 'center', titleColor: '', subtitleColor: '', paddingTop: '2.5rem', paddingBottom: '0.5rem',
  } },
  { id: 's13', type: 'text', order: 6.3, settings: {
    heading: '', content: 'Empezamos con una plancha y muchas ganas. Hoy enviamos a todo el Perú, pero cada prenda pasa por las mismas manos: revisamos tu diseño, lo probamos en tela y recién ahí lo estampamos.\nSi algo no queda como esperabas, lo rehacemos.',
    textAlign: 'center', textColor: '#333333', headingColor: '#000000', maxWidth: '680px', buttonText: 'Conoce el taller', buttonLink: '#oferta-flash',
    paddingTop: '0.5rem', paddingBottom: '1.5rem',
  } },
  { id: 's14', type: 'video', order: 6.4, settings: {
    url: '/landing-matador/video/video-01.mp4', aspectRatio: '9:16', autoplay: true, loop: true, paddingTop: '0.5rem', paddingBottom: '2rem',
  } },
  { id: 's15', type: 'image', order: 6.5, settings: {
    url: '/crear/banner-crear-1200.webp', alt: 'Crea tu polera en Walá', link: '/personalizar', maxWidth: '960px', alignment: 'center', borderRadius: '20px',
    paddingTop: '0rem', paddingBottom: '2rem',
  } },
  { id: 's7', type: 'testimonials', order: 6.7, settings: {
    title: 'Lo que dicen nuestros clientes', backgroundColor: 'rgba(139, 92, 246, 0.06)', paddingTop: '2rem', paddingBottom: '2rem',
    testimonials: [
      { topic: 'Calidad del producto', text: 'La polera llegó igualita al diseño y la tela es súper suave. Ya pedí otra para mi hermana.', author: 'Andrea P.', city: 'Lima', rating: 5, verified: true },
      { topic: 'Regalo', text: 'Le regalé la taza a mi mamá con nuestra foto y lloró de emoción. Llegó en 3 días.', author: 'Luis R.', city: 'Arequipa', rating: 5, verified: true },
      { topic: 'Atención', text: 'Me ayudaron por WhatsApp a ajustar mi diseño. Muy buena atención.', author: 'Camila T.', city: 'Trujillo', rating: 4 },
      { topic: 'Envío', text: 'Pensé que demoraría más a provincia, pero llegó rapidísimo y bien empacado.', author: 'Jorge M.', city: 'Cusco', rating: 5, verified: true },
    ],
  } },
  { id: 's8', type: 'marquee', order: 7, settings: {
    title: 'Nuestras marcas', speed: 25,
    items: [
      { imageUrl: '/marcas/con-amor.png', name: 'Con Amor', link: '/conamor', shape: 'circle' },
      { imageUrl: '/marcas/catas.png', name: 'Catas', link: '/catas', shape: 'circle' },
      { imageUrl: '/logo-wala-192.png', name: 'Walá', link: '/', shape: 'circle' },
    ],
    paddingTop: '1.5rem', paddingBottom: '1.5rem',
  } },
  { id: 's9', type: 'faq_accordion', order: 8, settings: {
    title: 'Preguntas frecuentes', subtitle: 'Resolvemos las dudas más comunes antes de tu compra.', layout: 'split', defaultOpen: true,
    items: [
      { id: 'faq_shipping', question: '¿Realizan envíos a todo el Perú?', answer: 'Sí. Atendemos pedidos para Lima y provincias. El costo y el plazo estimado se confirman según el destino antes de completar el pedido.' },
      { id: 'faq_production', question: '¿Cuánto demora un producto personalizado?', answer: 'Depende del producto, la cantidad y el diseño. Te confirmamos el plazo de producción antes de empezar tu pedido.' },
      { id: 'faq_customization', question: '¿Cómo personalizo mi producto?', answer: 'Puedes crear tu diseño desde Walá o escribirnos para orientarte con imágenes, textos, colores y acabados.' },
      { id: 'faq_changes', question: '¿Puedo pedir un cambio o devolución?', answer: 'Si tu pedido llega con un error o daño, escríbenos con tu número de pedido y fotos. Lo revisamos según nuestras políticas.' },
    ],
    paddingTop: '1.5rem', paddingBottom: '2rem',
  } },
];

/* Marcas como las guarda tienda_brands (las lee getBrands() en la tienda). */
const MARCAS_DEMO = [
  { id: 'conamor', name: 'Con Amor', slug: 'conamor', logoUrl: '/marcas/con-amor.png', active: true },
  { id: 'kapi', name: 'Kapi', slug: 'kapi', logoUrl: '/assets/kapi/kapi-happy.webp', bgColor: '#0f766e', active: true },
  { id: 'catas', name: 'Catas', slug: 'catas', logoUrl: '/marcas/catas.png', active: true },
  { id: 'geeks', name: 'Con Amor Geeks', slug: 'geeks', active: true },
  { id: 'nova', name: 'Nova', slug: 'nova', active: true },
  { id: 'oculta', name: 'Marca oculta', slug: 'oculta', visible: false },
];

const productosParaSeccion = (sec) => {
  if (sec.type === 'flash_sales') return ['essentials', 'taza', 'kapi', 'combo', 'cuadro'].map(productoDemo);
  return PRODUCTOS_DEMO;
};

const COLORES_PRENDA = [
  { nombre: 'Negro', hex: '#111827' },
  { nombre: 'Blanco', hex: '#f8fafc', claro: true },
  { nombre: 'Lila', hex: '#c4b5fd', claro: true },
  { nombre: 'Verde oliva', hex: '#4d5b3a' },
  { nombre: 'Rojo vino', hex: '#7f1d1d' },
];

const ahora = Date.now();
const NOTIFICACIONES_INICIALES = [
  { id: 'n1', tipo: 'info', titulo: 'Tu pedido #WL-20377 va en camino', texto: 'Llega mañana, 14 oct', fecha: ahora - 12 * 60000, leida: false },
  { id: 'n2', tipo: 'exito', titulo: '¡Pago recibido!', texto: 'Pedido #WL-20481 · S/ 129.80', fecha: ahora - 95 * 60000, leida: false },
  { id: 'n3', tipo: 'aviso', titulo: 'Tu cupón WALA10 vence hoy', texto: 'Úsalo en tu próxima compra', fecha: ahora - 5 * 3600000, leida: true },
  { id: 'n4', tipo: 'exito', titulo: 'Kapi te regaló 45 monedas', texto: 'Por completar la misión semanal', fecha: ahora - 26 * 3600000, leida: true },
];

/* Datos de ejemplo de los menús (en la app salen de Firestore / AuthContext / CartContext). */
const MENU_TIENDA = {
  categorias: [
    { id: 'polos', nombre: 'Polos', url: '/tienda?categoria=polos' },
    { id: 'poleras', nombre: 'Poleras', url: '/tienda?categoria=poleras' },
    { id: 'tazas', nombre: 'Tazas', url: '/tienda?categoria=tazas' },
    { id: 'gorras', nombre: 'Gorras', url: '/tienda?categoria=gorras' },
    { id: 'parejas', nombre: 'Para parejas', url: '/tienda?categoria=parejas' },
    { id: 'cumple', nombre: 'Cumpleaños', url: '/tienda?categoria=cumple' },
    { id: 'peluches', nombre: 'Peluches', url: '/tienda?categoria=peluches' },
    { id: 'llaveros', nombre: 'Llaveros', url: '/tienda?categoria=llaveros' },
  ],
  activa: 'poleras',
  marcas: [
    { id: 'conamor', nombre: 'Con Amor', url: '/conamor' },
    { id: 'geeks', nombre: 'Con Amor Geeks', url: '/geeks' },
    { id: 'nova', nombre: 'Nova', url: '/nova' },
    { id: 'catas', nombre: 'Catas', url: '/catas' },
    { id: 'kapi', nombre: 'Kapi', url: '/kapi' },
    { id: 'deporte', nombre: 'Deporte', url: '/deporte' },
    { id: 'familia', nombre: 'Familia', url: '/familia' },
  ],
};

const FAVORITOS_DEMO = [
  { id: 'f1', nombre: 'Polera Essentials', imagen: FRENTE_BLANCO },
  { id: 'f2', nombre: 'Polera con tu diseño', imagen: ESPALDA_BLANCO },
  { id: 'f3', nombre: 'Polera oversize', imagen: FRENTE },
  { id: 'f4', nombre: 'Combo Él y Ella', imagen: ESPALDA },
  { id: 'f5', nombre: 'Polera Essentials blanca', imagen: FRENTE_BLANCO },
  { id: 'f6', nombre: 'Polera edición limitada', imagen: ESPALDA_BLANCO },
  { id: 'f7', nombre: 'Taza Kapi', imagen: FRENTE },
];

const USUARIO_DEMO = { nombre: 'Isaac Castro', email: 'isaac@correo.com' };
const GRUPOS_CUENTA = [
  { titulo: 'Mis compras', items: [
    { to: '/cuenta/pedidos', texto: 'Mis pedidos', Icono: Package },
    { to: '/cuenta/cupones', texto: 'Mis cupones', Icono: Ticket },
    { to: '/cuenta/catalogo', texto: 'Canjear monedas', Icono: Gift },
  ] },
  { titulo: 'Mi perfil', items: [
    { to: '/cuenta/perfil', texto: 'Mi perfil', Icono: UserRound },
    { to: '/cuenta/creaciones', texto: 'Mis creaciones', Icono: Palette },
    { to: '/cuenta/ajustes', texto: 'Ajustes', Icono: Settings },
  ] },
];
const PROMO_CUENTA = { texto: 'Cuéntanos de ti y gana 50 monedas', url: '/encuesta-suscripcion' };

const CARRITO_INICIAL = [
  { id: 'essentials', imagen: FRENTE_BLANCO, nombre: 'Polera Walá Essentials con capucha', variante: 'Negro · M', precio: 89.9, precioAntes: 129.9, cantidad: 1 },
  { id: 'diseno', imagen: ESPALDA, nombre: 'Polera con tu diseño en la espalda', variante: 'Lila · L', precio: 39.9, cantidad: 1, personalizado: true },
];

/* ── Piezas de la página ───────────────────────────────── */

function Seccion({ id, numero, titulo, descripcion, mejoras, children }) {
  return (
    <section id={id} className={s.seccion} aria-labelledby={`${id}-t`}>
      <Revelar as="header" className={s.seccionCabeza}>
        <span className={s.numero}>{numero}</span>
        <h2 id={`${id}-t`}>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
        {mejoras && (
          <ul className={s.mejoras} aria-label="Qué mejora">
            {mejoras.map((m, i) => (
              <motion.li
                key={m}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: EASE }}
              >
                <Sparkles aria-hidden="true" />{m}
              </motion.li>
            ))}
          </ul>
        )}
      </Revelar>
      {children}
    </section>
  );
}

/** Panel: aparece suave al hacer scroll. Superficie sólida (sin blur): más liviano en la app. */
function Panel({ titulo, children, className, retraso = 0 }) {
  return (
    <Revelar retraso={retraso} className={[s.panel, className].filter(Boolean).join(' ')}>
      {titulo && <p className={s.panelTitulo}>{titulo}</p>}
      {children}
    </Revelar>
  );
}

function Muestra({ nombre, valor, variable, oscuro }) {
  return (
    <div className={s.muestra}>
      <span
        className={s.muestraColor}
        style={{ background: variable ? `var(${variable}, ${valor})` : valor, color: oscuro ? '#fff' : '#0f172a' }}
      >
        Aa
      </span>
      <span className={s.muestraNombre}>{nombre}</span>
      <code>{valor}</code>
    </div>
  );
}

/** Índice fijo: píldora que se desliza a la sección visible + barra de progreso. */
function BarraSuperior({ tema, cambiarTema }) {
  const [activa, setActiva] = useState('base');
  const navRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const progreso = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => { if (e.isIntersecting) setActiva(e.target.id); }),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    SECCIONES.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  // En móvil el índice se desplaza solo para que el activo quede a la vista.
  useEffect(() => {
    const nav = navRef.current;
    const a = nav?.querySelector(`[data-id="${activa}"]`);
    if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  }, [activa]);

  return (
    <div className={s.barraTop}>
      <div className={s.barraTopDentro}>
        <a href="#inicio" className={s.marca}>
          <Logo alto={32} />
          <span className={s.marcaTexto}>Componentes</span>
        </a>
        <nav ref={navRef} className={s.indice} aria-label="Secciones">
          {SECCIONES.map(([id, t]) => (
            <a key={id} href={`#${id}`} data-id={id} className={activa === id ? s.indiceActivo : undefined}>
              {activa === id && <motion.span layoutId="indice-activo" className={s.indicePildora} transition={RESORTE} />}
              <span>{t}</span>
            </a>
          ))}
        </nav>
        <button
          type="button"
          className={s.tema}
          onClick={cambiarTema}
          aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo noche'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={tema}
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ display: 'inline-flex' }}
            >
              {tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <motion.div className={s.progreso} style={{ scaleX: progreso }} />
    </div>
  );
}

/** Portada: texto a la izquierda y una escena flotante a la derecha. */
function Portada({ tema, cambiarTema, manejarAgregar }) {
  const aparecer = (i) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay: 0.1 + i * 0.1 },
  });
  return (
    <section id="inicio" className={s.hero}>
      <div className={s.heroTexto}>
        <motion.div {...aparecer(0)}>
          <Etiqueta icono={<Sparkles aria-hidden="true" />}>Kit de interfaz · v2</Etiqueta>
        </motion.div>
        <motion.h1 {...aparecer(1)}>
          Componentes que <span className={s.degradado}>brillan</span> en Walá
        </motion.h1>
        <motion.p {...aparecer(2)}>
          Los colores, la tipografía y el modo noche de la tienda, ahora con luz, profundidad y
          movimiento. Pasa el ratón, toca y arrastra: todo responde, también en el celular.
        </motion.p>
        <motion.div className={s.heroAcciones} {...aparecer(3)}>
          <Boton tamano="lg" brillo iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => document.getElementById('productos')?.scrollIntoView()}>
            Ver componentes
          </Boton>
          <Boton tamano="lg" variante="contorno" icono={tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} onClick={cambiarTema}>
            {tema === 'dark' ? 'Modo claro' : 'Modo noche'}
          </Boton>
        </motion.div>
        <motion.ul className={s.datosHero} {...aparecer(4)}>
          <li><strong>30+</strong> componentes</li>
          <li><strong>2</strong> temas</li>
          <li><strong>100%</strong> táctil</li>
        </motion.ul>
      </div>

      <motion.div
        className={s.escena}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      >
        <span className={s.orbe} aria-hidden="true" />
        <span className={s.anillo} aria-hidden="true" />
        <div className={s.escenaTarjeta}>
          <TarjetaProducto
            imagen={FRENTE_BLANCO} imagenHover={ESPALDA_BLANCO}
            categoria="Más vendido" nombre="Polera Walá Essentials con capucha"
            precio={89.9} precioAntes={129.9} puntuacion={4.8} resenas={124}
            colores={['#111827', '#f8fafc', '#c4b5fd', '#4d5b3a']}
            accion="elegir"
            onAgregar={manejarAgregar(productoDemo('essentials'))}
          />
        </div>
        <img src={MONEDA} alt="" className={`${s.moneda} ${s.moneda1}`} aria-hidden="true" />
        <img src={MONEDA} alt="" className={`${s.moneda} ${s.moneda2}`} aria-hidden="true" />
        <div className={s.flotaSaldo} aria-hidden="true"><GananciaMonedas monto={90} /></div>
        <div className={s.flotaToast} aria-hidden="true">
          <CheckCircle2 />
          <span><strong>¡Pedido en camino!</strong><small>Llega mañana</small></span>
        </div>
        <img src="/assets/kapi/kapi-happy.webp" alt="" className={s.kapi} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa1}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa2}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa3}`} aria-hidden="true" />
      </motion.div>
    </section>
  );
}

/* ── Contenido ─────────────────────────────────────────── */

/** En esta página de prueba los enlaces no navegan: avisan a dónde irían. */
const EnlaceDemo = React.forwardRef(function EnlaceDemo({ to, onClick, children, ...rest }, ref) {
  const toast = useToast();
  return (
    <a
      ref={ref}
      href={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        toast({ tipo: 'info', titulo: 'En la tienda iría a', texto: to, duracion: 2200 });
      }}
    >
      {children}
    </a>
  );
});

function Contenido({ tema, cambiarTema }) {
  const toast = useToast();
  const [conSesion, setConSesion] = useState(true);
  const [seleccion, setSeleccion] = useState(null); // producto en el selector rápido
  const [tiendaCargando, setTiendaCargando] = useState(false);
  const { historial, noLeidas, marcarLeidas, leer, abrirCentro } = useNotificaciones();
  const [talla, setTalla] = useState('M');
  const [color, setColor] = useState('Negro');
  const [cantidad, setCantidad] = useState(1);
  const [filtros, setFiltros] = useState(['Polos']);
  const [notif, setNotif] = useState(true);
  const [ofertas, setOfertas] = useState(false);
  const [pestana, setPestana] = useState('activos');
  const [hoja, setHoja] = useState(false);
  const [hojaMovil, setHojaMovil] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [carrito, setCarrito] = useState(CARRITO_INICIAL);
  const [saldo, setSaldo] = useState(1250);
  const cerrarHoja = useCallback(() => setHoja(false), []);
  const cerrarHojaMovil = useCallback(() => setHojaMovil(false), []);

  // "Agregar" según el producto: directo, abrir el selector o ir a Crear.
  const manejarAgregar = (producto) => () => {
    const accion = accionDeProducto(producto);
    if (accion === 'elegir') { setSeleccion(producto); return false; }
    if (accion === 'crear') {
      toast({ tipo: 'info', titulo: 'En la tienda iría al estudio', texto: `/crear/${producto.id}`, duracion: 2200 });
      return false;
    }
    toast({ titulo: 'Agregado al carrito', texto: producto.name, imagen: producto.mainImage, accion: 'Ver' });
    return true;
  };

  const alternarFiltro = (f) =>
    setFiltros((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));

  const simularCarga = () => {
    setCargando(true);
    window.setTimeout(() => {
      setCargando(false);
      toast({ titulo: 'Agregado al carrito', texto: 'Polera Walá Essentials · M · Negro', imagen: FRENTE, accion: 'Ver' });
    }, 1200);
  };

  const cuentas = useMemo(() => {
    const bruto = carrito.reduce((a, it) => a + (it.precioAntes ?? it.precio) * it.cantidad, 0);
    const neto = carrito.reduce((a, it) => a + it.precio * it.cantidad, 0);
    return { bruto, neto, descuento: bruto - neto, envio: neto >= META_ENVIO || neto === 0 ? 0 : 12 };
  }, [carrito]);
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  const cambiarCantidad = (id) => (n) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad: n } : it)));
  const quitar = (id) => () => setCarrito((c) => c.filter((it) => it.id !== id));

  return (
    <div className={s.pagina}>
      <div className={s.aurora} aria-hidden="true">
        <span className={s.b1} />
        <span className={s.b2} />
        <span className={s.b3} />
      </div>

      <BarraSuperior tema={tema} cambiarTema={cambiarTema} />

      <main className={s.main}>
        <Portada tema={tema} cambiarTema={cambiarTema} manejarAgregar={manejarAgregar} />

        {/* ── BASE ── */}
        <Seccion
          id="base" numero="01" titulo="Base"
          descripcion="Los tokens que ya usa la app (variables.css y tokens.css). El kit no inventa colores nuevos."
        >
          <div className={s.grid2}>
            <Panel titulo="Violeta de marca">
              <div className={s.muestras}>
                <Muestra nombre="Violeta 100" valor="#EDE9FE" variable="--violet-100" />
                <Muestra nombre="Violeta 300" valor="#C4B5FD" variable="--violet-300" />
                <Muestra nombre="Violeta 500" valor="#8B5CF6" variable="--violet-500" oscuro />
                <Muestra nombre="Violeta 700" valor="#6D28D9" variable="--violet-700" oscuro />
                <Muestra nombre="Violeta 900" valor="#4C1D95" variable="--violet-900" oscuro />
              </div>
            </Panel>
            <Panel titulo="Estados y fidelización" retraso={0.08}>
              <div className={s.muestras}>
                <Muestra nombre="Éxito" valor="#10B981" variable="--verde-exito" oscuro />
                <Muestra nombre="Aviso" valor="#F59E0B" variable="--warning" />
                <Muestra nombre="Error" valor="#EF4444" variable="--danger" oscuro />
                <Muestra nombre="Oro" valor="#D97706" variable="--gold-600" oscuro />
                <Muestra nombre="Texto" valor="#0F172A" oscuro />
              </div>
            </Panel>
          </div>
          <Panel titulo="Tipografía · Poppins">
            <div className={s.tipos}>
              <p className={s.t1}>Regalos que <span className={s.degradado}>hablan</span> por ti</p>
              <p className={s.t2}>Diseña tu polera en 2 minutos</p>
              <p className={s.t3}>Título de sección</p>
              <p className={s.t4}>Texto de cuerpo para descripciones de producto, ayudas y mensajes. Se lee cómodo en móvil.</p>
              <p className={s.t5}>TEXTO PEQUEÑO · CATEGORÍAS · ETIQUETAS</p>
            </div>
          </Panel>
        </Seccion>

        {/* ── BOTONES ── */}
        <Seccion
          id="botones" numero="02" titulo="Botones"
          descripcion="Pasa el ratón para ver el destello y el halo; tócalos para ver la onda (también en el celular)."
          mejoras={['Destello que cruza al pasar el ratón', 'Onda desde donde tocas', 'Halo violeta al levantarse', 'Brillo automático para CTAs']}
        >
          <Panel titulo="Variantes">
            <div className={s.fila}>
              <Boton icono={<ShoppingBag aria-hidden="true" />}>Agregar al carrito</Boton>
              <Boton variante="secundario" icono={<Wand2 aria-hidden="true" />}>Personalizar</Boton>
              <Boton variante="contorno">Ver detalles</Boton>
              <Boton variante="fantasma" iconoFin={<ArrowRight aria-hidden="true" />}>Ver todo</Boton>
              <Boton variante="peligro" icono={<Trash2 aria-hidden="true" />}>Eliminar</Boton>
            </div>
          </Panel>
          <div className={s.grid2}>
            <Panel titulo="Tamaños">
              <div className={s.fila}>
                <Boton tamano="sm">Pequeño</Boton>
                <Boton>Mediano</Boton>
                <Boton tamano="lg">Grande</Boton>
              </div>
            </Panel>
            <Panel titulo="Estados" retraso={0.08}>
              <div className={s.fila}>
                <Boton cargando={cargando} onClick={simularCarga}>{cargando ? 'Agregando…' : 'Pruébame'}</Boton>
                <Boton disabled>Sin stock</Boton>
                <Boton soloIcono variante="contorno" aria-label="Me gusta"><Heart aria-hidden="true" /></Boton>
                <Boton soloIcono variante="secundario" aria-label="Agregar"><Plus aria-hidden="true" /></Boton>
              </div>
            </Panel>
          </div>
          <Panel titulo="CTA con brillo automático (checkout, pagar)" className={s.angosto}>
            <Boton tamano="lg" bloque brillo>Pagar {soles(129.8)}</Boton>
          </Panel>
        </Seccion>

        {/* ── ETIQUETAS ── */}
        <Seccion
          id="etiquetas" numero="03" titulo="Etiquetas, chips y monedas"
          mejoras={['Ofertas con destello periódico', 'Lo que cuesta dice "CUESTA"; lo que ganas lleva +', 'La moneda gira y el saldo corre']}
        >
          <div className={s.grid2}>
            <Panel titulo="Etiquetas">
              <div className={s.fila}>
                <Etiqueta tono="peligro" solida>-30%</Etiqueta>
                <Etiqueta solida>Nuevo</Etiqueta>
                <Etiqueta tono="exito" solida>Envío gratis</Etiqueta>
                <Etiqueta>Personalizable</Etiqueta>
                <Etiqueta tono="oscuro">Combo</Etiqueta>
                <Etiqueta tono="aviso">Últimas 3</Etiqueta>
                <Etiqueta tono="neutro">Agotado</Etiqueta>
              </div>
            </Panel>
            <Panel titulo="Monedas" retraso={0.08}>
              <div className={s.fila}>
                <SaldoMonedas saldo={saldo} onClick={() => setSaldo((v) => v + 45)} />
                <CostoMonedas monto={300} />
                <GananciaMonedas monto={45} />
              </div>
              <p className={s.nota}>Toca el saldo: suma 45 y el número corre.</p>
            </Panel>
          </div>
          <Panel titulo="Chips de filtro">
            <div className={s.fila}>
              {['Polos', 'Poleras', 'Tazas', 'Gorras', 'Para parejas', 'Cumpleaños'].map((f) => (
                <Chip key={f} activo={filtros.includes(f)} onClick={() => alternarFiltro(f)}>{f}</Chip>
              ))}
            </div>
          </Panel>
        </Seccion>

        {/* ── FORMULARIOS ── */}
        <Seccion
          id="formularios" numero="04" titulo="Formularios y selección"
          mejoras={['Línea de luz al enfocar', 'La talla elegida se desliza', 'La cantidad rueda', 'El error entra con una sacudida']}
        >
          <div className={s.grid2}>
            <Panel titulo="Campos">
              <div className={s.columna}>
                <Campo etiqueta="Nombre completo" placeholder="Ej. María Pérez" icono={<User />} />
                <Campo etiqueta="Correo" type="email" defaultValue="maria@correo" icono={<Mail />} error="Falta el dominio, por ejemplo @gmail.com" />
                <Campo etiqueta="Celular" type="tel" placeholder="999 999 999" icono={<Phone />} ayuda="Te escribimos por WhatsApp cuando salga tu pedido." />
                <Campo etiqueta="Texto para tu taza" placeholder="Feliz día, mamá" sufijo="0/24" />
              </div>
            </Panel>
            <Panel titulo="Variantes de producto" retraso={0.08}>
              <div className={s.columna}>
                <SelectorTalla tallas={['XS', 'S', 'M', 'L', 'XL', 'XXL']} agotadas={['XS', 'XXL']} valor={talla} onChange={setTalla} guia={() => {}} />
                <SelectorColor colores={COLORES_PRENDA} valor={color} onChange={setColor} />
                <div className={s.filaEntre}>
                  <span className={s.etq}>Cantidad</span>
                  <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
                </div>
                <div className={s.separador} />
                <Interruptor etiqueta="Avisos de mi pedido" descripcion="Push y WhatsApp" activo={notif} onChange={setNotif} />
                <Interruptor etiqueta="Ofertas y cupones" activo={ofertas} onChange={setOfertas} />
              </div>
            </Panel>
          </div>
        </Seccion>

        {/* ── PRODUCTOS ── */}
        <Seccion
          id="productos" numero="05" titulo="Tarjeta de producto"
          descripcion="No todo es ropa: el botón cambia según el producto. La taza se agrega directo; poleras, peluche, cuadro y combo abren el selector con sus propias opciones (talla, modelo, medida, color por pieza); la prenda de Crear va al estudio. Son productos con la misma forma que en Firestore, pasados por el adaptador del kit."
          mejoras={['Agregar / Elegir / Diseñar según el producto', 'Talla, medida, modelo o color por pieza', 'Fotos con fondo blanco sin recuadro', 'Alturas parejas en la cuadrícula']}
        >
          <div className={s.gridProductos}>
            {PRODUCTOS_DEMO.map((p, i) => (
              <Revelar key={p.id} retraso={i * 0.05} className={s.celda}>
                <TarjetaProducto {...tarjetaDesdeProducto(p)} {...EXTRAS_DEMO[p.id]} onAgregar={manejarAgregar(p)} />
              </Revelar>
            ))}
            <Revelar retraso={0.4} className={s.celda}><TarjetaProductoEsqueleto /></Revelar>
          </div>
        </Seccion>

        {/* ── NAVEGACIÓN ── */}
        <Seccion
          id="navegacion" numero="06" titulo="Navegación"
          mejoras={['Línea de luz de marca en la cabecera', 'Píldora que sigue al ratón', 'Logo con destello y avatar con anillo', 'Barra móvil con indicador deslizante']}
        >
          <Panel titulo="Cabecera" className={s.panelFondo}>
            <Cabecera
              activo="tienda"
              menuTienda={{ ...MENU_TIENDA, destacado: { titulo: 'Polera Essentials', texto: 'Lo más vendido · -31%', url: '/producto/essentials', imagen: FRENTE_BLANCO } }}
              monedas={saldo}
              notificaciones={historial}
              onLeer={leer}
              onMarcarLeidas={marcarLeidas}
              onVerTodas={abrirCentro}
              usuario={conSesion ? USUARIO_DEMO : null}
              gruposCuenta={GRUPOS_CUENTA}
              promoCuenta={PROMO_CUENTA}
              onCerrarSesion={() => { setConSesion(false); toast({ tipo: 'info', titulo: 'Sesión cerrada' }); }}
              favoritos={conSesion ? FAVORITOS_DEMO : []}
              carrito={carrito}
            />
            <div className={s.fila}>
              <Interruptor etiqueta="Con sesión iniciada" descripcion="Cambia el menú de cuenta y favoritos" activo={conSesion} onChange={setConSesion} />
            </div>
            <p className={s.nota}>Pasa el ratón por “Tienda”, las monedas, la campana, el corazón, la bolsa y el avatar. Un clic deja el menú fijo; Esc o un clic fuera lo cierran.</p>
          </Panel>
          <div className={s.gridNav}>
            <Panel titulo="Pestañas (Mis pedidos)">
              <Pestanas
                etiqueta="Filtrar pedidos"
                valor={pestana}
                onChange={setPestana}
                opciones={[
                  { id: 'activos', texto: 'Activos', cuenta: 2 },
                  { id: 'pago', texto: 'Por pagar', cuenta: 1 },
                  { id: 'entregados', texto: 'Entregados' },
                ]}
              />
              <div className={s.separador} />
              <p className={s.panelTitulo}>Hoja inferior / modal</p>
              <p className={s.nota}>
                En el celular sube desde abajo y se cierra arrastrándola hacia abajo; en escritorio es un modal
                centrado. También se cierra con Esc o tocando fuera.
              </p>
              <div className={s.fila}>
                <Boton variante="secundario" onClick={() => setHoja(true)}>Abrir modal</Boton>
                <Boton variante="contorno" onClick={() => setHojaMovil(true)}>Abrir en el teléfono</Boton>
              </div>
            </Panel>
            <Revelar retraso={0.1} className={s.telefono}>
              <div className={s.telefonoPantalla}>
                <span className={s.isla} aria-hidden="true" />
                <div className={s.telefonoTop}>
                  <Logo alto={28} />
                  <span className={s.telefonoIconos}>
                    <Search aria-hidden="true" />
                    <button type="button" className={s.telefonoCampana} onClick={abrirCentro} aria-label={`Notificaciones (${noLeidas} sin leer)`}>
                      <span className={s.iconoConContador}>
                        <Bell aria-hidden="true" />
                        <Contador valor={noLeidas} />
                      </span>
                    </button>
                  </span>
                </div>
                <div className={s.telefonoContenido}>
                  <BarraEnvioGratis actual={cuentas.neto} meta={META_ENVIO} />
                  <div className={s.telefonoGrid}>
                    <TarjetaProducto imagen={FRENTE_BLANCO} categoria="Poleras" nombre="Polera Essentials" precio={89.9} precioAntes={129.9} puntuacion={4.8} resenas={124} inclinar={false} accion="elegir" onAgregar={manejarAgregar(productoDemo('essentials'))} />
                    <TarjetaProducto imagen={TAZA} categoria="Tazas" nombre="Taza mágica «Feliz día»" precio={34.9} inclinar={false} onAgregar={manejarAgregar(productoDemo('taza'))} />
                  </div>
                </div>
                <BarraInferior carrito={enCarrito} />
                <HojaInferior
                  contenida
                  abierta={hojaMovil}
                  onCerrar={cerrarHojaMovil}
                  titulo="Elige tu talla"
                  pie={<Boton bloque brillo onClick={cerrarHojaMovil}>Agregar · {soles(89.9)}</Boton>}
                >
                  <SelectorTalla tallas={['S', 'M', 'L', 'XL']} agotadas={['XL']} valor={talla} onChange={setTalla} />
                </HojaInferior>
              </div>
            </Revelar>
          </div>
        </Seccion>

        {/* ── MENÚS DE LA CABECERA ── */}
        <Seccion
          id="menus" numero="07" titulo="Menús de la cabecera"
          descripcion="El contenido de cada menú, por separado. Son los mismos componentes que se abren en la cabecera: en escritorio como panel al pasar el ratón y en el celular como hoja inferior."
          mejoras={['Un solo componente base (Desplegable)', 'Estados de carga, vacío y sin sesión', 'Enlaces del router sin recargar']}
        >
          <div className={s.gridMenus}>
            <Panel titulo="Tienda (categorías y marcas)" className={s.menuAncho}>
              <div className={s.fila}>
                <Interruptor etiqueta="Simular carga" activo={tiendaCargando} onChange={setTiendaCargando} />
              </div>
              <div className={s.marcoMenu}>
                <MenuTienda {...MENU_TIENDA} cargando={tiendaCargando} />
              </div>
            </Panel>
            <Panel titulo="Monedas">
              <div className={s.marcoMenu}><AyudaMonedas saldo={saldo} /></div>
            </Panel>
            <Panel titulo={conSesion ? 'Cuenta (con sesión)' : 'Cuenta (sin sesión)'}>
              <div className={s.marcoMenu}>
                <MenuCuenta usuario={conSesion ? USUARIO_DEMO : null} grupos={GRUPOS_CUENTA} promo={PROMO_CUENTA} onCerrarSesion={() => setConSesion(false)} />
              </div>
            </Panel>
            <Panel titulo="Favoritos">
              <div className={s.marcoMenu}><VistaFavoritos items={conSesion ? FAVORITOS_DEMO : []} sesion={conSesion} /></div>
            </Panel>
            <Panel titulo="Carrito">
              <div className={s.marcoMenu}><VistaCarrito items={carrito} /></div>
            </Panel>
          </div>
        </Seccion>

        {/* ── BUILDER ── */}
        <Seccion
          id="builder" numero="08" titulo="Secciones del builder"
          descripcion="Esta mini página está escrita como la guarda Firestore: una lista de secciones { type, settings } con los mismos campos que hoy usa el editor visual. RenderSecciones la dibuja con piezas del kit: un solo carrusel, una sola marquesina, una sola cuenta regresiva, un solo título y un solo bloque para relleno y fondo."
          mejoras={['1 carrusel en vez de 6', '1 marquesina en vez de 3', '1 cuenta regresiva en vez de 2', 'Títulos y fondos iguales en todas', 'Enlaces internos, externos y #ancla con una regla', 'Textos viejos en negro se adaptan al modo noche', 'Videos que se pausan fuera de pantalla']}
        >
          <Revelar className={s.paginaBuilder}>
            <RenderSecciones
              secciones={SECCIONES_DEMO}
              productosPara={productosParaSeccion}
              marcasPara={() => MARCAS_DEMO}
              onAgregar={manejarAgregar}
            />
          </Revelar>
        </Seccion>

        {/* ── EDITOR DEL BUILDER ── */}
        <Seccion
          id="editor" numero="09" titulo="Editor del builder"
          descripcion="El mismo editor para todas las secciones: cada tipo describe sus campos una vez y el panel los dibuja. Toca una sección de la página o elígela en el panel, cambia textos, colores o fotos y mira el cambio al instante. Arrastra las filas para reordenar, usa el + entre secciones para insertar y Ctrl+Z para deshacer."
          mejoras={['1 formulario por esquema en vez de 30 copiados', 'Colores con opción «del tema» (modo noche)', 'Fechas en hora de Perú', 'Deshacer y rehacer', 'Eliminar sin ventanas del navegador', 'Hoja inferior en el celular']}
        >
          <DemoEditor
            productos={PRODUCTOS_DEMO}
            marcas={MARCAS_DEMO}
            categorias={SECCIONES_DEMO.find((x) => x.type === 'category_grid').settings.items}
            categoriaDe={(p) => EXTRAS_DEMO[p.id]?.categoria}
            imagenes={{ taller: ESPALDA_BLANCO }}
            onAgregar={manejarAgregar}
          />
        </Seccion>

        {/* ── CARRITO ── */}
        <Seccion
          id="carrito" numero="10" titulo="Carrito y resumen"
          descripcion="Funciona de verdad: sube la cantidad hasta pasar S/ 150 y mira qué pasa. Prueba el cupón WALA10."
          mejoras={['Camión que avanza hacia el envío gratis', 'Confeti al llegar a la meta', 'Totales que corren', 'Quitar con animación']}
        >
          <div className={s.gridCarrito}>
            <Panel>
              <BarraEnvioGratis actual={cuentas.neto} meta={META_ENVIO} />
              <div>
                <AnimatePresence initial={false}>
                  {carrito.map((it) => (
                    <motion.div
                      key={it.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, x: -40 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <ItemCarrito
                        {...it}
                        cantidad={it.cantidad}
                        onCantidad={cambiarCantidad(it.id)}
                        onQuitar={quitar(it.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {carrito.length === 0 && (
                  <EstadoVacio titulo="Tu carrito está vacío" texto="Lo quitaste todo. Vuelve a llenarlo para seguir probando.">
                    <Boton icono={<RotateCcw aria-hidden="true" />} onClick={() => setCarrito(CARRITO_INICIAL)}>Restaurar carrito</Boton>
                  </EstadoVacio>
                )}
              </div>
            </Panel>
            <Revelar retraso={0.1}>
              <ResumenPedido
                subtotal={cuentas.bruto}
                descuento={cuentas.descuento}
                envio={cuentas.envio}
                monedas={Math.round(cuentas.neto)}
              />
            </Revelar>
          </div>
        </Seccion>

        {/* ── PEDIDOS ── */}
        <Seccion
          id="pedidos" numero="11" titulo="Mis pedidos"
          descripcion="Una sola tarjeta con resumen, seguimiento y la acción que toca."
          mejoras={['La línea se dibuja al aparecer', 'El paso actual late', 'Si falta pagar, el borde respira en ámbar', 'Copiar con burbuja']}
        >
          <div className={s.gridPedidos}>
            <Revelar>
              <SeguimientoPedido
                codigo="WL-20481" fecha="10 oct" paso={1} total={129.8} pagoPendiente
                items={[
                  { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Negro · M', cantidad: 1, precio: 89.9 },
                  { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · L', cantidad: 1, precio: 39.9 },
                ]}
              />
            </Revelar>
            <Revelar retraso={0.08}>
              <SeguimientoPedido
                codigo="WL-20377" fecha="7 oct" paso={3} total={169.9} entregaEstimada="mañana, 14 oct"
                items={[{ imagen: FRENTE, nombre: 'Combo Él y Ella', variante: 'Negro / Rojo vino', cantidad: 1, precio: 169.9 }]}
              />
            </Revelar>
            <Revelar retraso={0.16}>
              <SeguimientoPedido
                codigo="WL-19902" fecha="28 sep" paso={4} total={359.6}
                items={[
                  { imagen: ESPALDA, nombre: 'Polera oversize', variante: 'Negro · L', cantidad: 2, precio: 99.9 },
                  { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Blanco · S', cantidad: 1, precio: 59.9 },
                  { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · M', cantidad: 1, precio: 99.9 },
                  { imagen: FRENTE, nombre: 'Regalo sorpresa', variante: 'Única', cantidad: 1, precio: 0 },
                ]}
              />
            </Revelar>
          </div>
        </Seccion>

        {/* ── AVISOS ── */}
        <Seccion
          id="avisos" numero="12" titulo="Avisos y estados"
          descripcion="Si llegan varias notificaciones se apilan como en el celular; tócalas (o pasa el ratón) para desplegarlas y usa “Ver todas” para abrir el centro."
          mejoras={['Avisos limpios, sin franjas', 'Notificaciones apiladas', 'Centro con todas las notificaciones', 'Desliza un toast para cerrarlo']}
        >
          <div className={s.grid2}>
            <Panel titulo="Avisos en página">
              <div className={s.columna}>
                <Aviso tipo="exito" titulo="¡Pago recibido!">Tu pedido #WL-20377 ya pasó a producción.</Aviso>
                <Aviso tipo="info" titulo="Tu diseño se guardó">Puedes seguir editándolo desde Mis creaciones.</Aviso>
                <Aviso tipo="aviso" titulo="Quedan 3 en tu talla" onCerrar={() => {}} />
                <Aviso tipo="error" titulo="No pudimos procesar la tarjeta" accion={<Boton tamano="sm" variante="contorno">Probar con Yape</Boton>}>
                  El banco la rechazó. No se te cobró nada.
                </Aviso>
              </div>
            </Panel>
            <Panel titulo="Toasts" retraso={0.08}>
              <div className={s.columna}>
                <p className={s.nota}>Aparecen abajo (en el celular, encima de la barra de navegación) y se van solos a los 4 s.</p>
                <div className={s.fila}>
                  <Boton variante="secundario" onClick={() => toast({ titulo: 'Agregado al carrito', texto: 'Polera Essentials · M', imagen: FRENTE, accion: 'Ver' })}>Producto</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'exito', titulo: 'Cupón aplicado', texto: 'Ahorras S/ 15.00' })}>Éxito</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'info', titulo: 'Guardado en deseos' })}>Info</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'error', titulo: 'Sin conexión', texto: 'Revisa tu internet' })}>Error</Boton>
                </div>
                <Boton
                  icono={<BellRing aria-hidden="true" />}
                  onClick={() => {
                    const lote = [
                      { tipo: 'info', titulo: 'Tu pedido salió del taller', texto: '#WL-20481 · En producción' },
                      { tipo: 'exito', titulo: 'Cupón aplicado', texto: 'Ahorras S/ 10.00' },
                      { titulo: 'Agregado al carrito', texto: 'Polera Essentials · M', imagen: FRENTE_BLANCO },
                      { tipo: 'aviso', titulo: 'Quedan 3 en tu talla', texto: 'Polera oversize · L' },
                    ];
                    lote.forEach((n, i) => window.setTimeout(() => toast(n), i * 350));
                  }}
                >
                  Lanzar 4 notificaciones
                </Boton>
              </div>
            </Panel>
          </div>
          <Panel titulo={`Centro de notificaciones · ${noLeidas} sin leer`} className={s.angostoAncho}>
            <ListaNotificaciones items={historial} limite={4} onAbrir={(n) => leer(n.id)} />
            <div className={s.fila}>
              <Boton variante="secundario" onClick={abrirCentro}>Ver todas</Boton>
              <Boton variante="fantasma" onClick={marcarLeidas} disabled={!noLeidas}>Marcar todas como leídas</Boton>
            </div>
          </Panel>
          <div className={s.grid2}>
            <Panel>
              <EstadoVacio titulo="Aún no tienes deseos" texto="Toca el corazón de lo que te guste y lo guardamos aquí.">
                <Boton>Ir a la tienda</Boton>
              </EstadoVacio>
            </Panel>
            <Panel retraso={0.08}>
              <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Aún no tienes pedidos" texto="Diseña algo único: Kapi te ayuda paso a paso.">
                <Boton variante="secundario" icono={<Wand2 aria-hidden="true" />}>Crear mi diseño</Boton>
              </EstadoVacio>
            </Panel>
          </div>
        </Seccion>

        <footer className={s.pie}>
          <Logo alto={26} />
          <span>Página local de componentes · <code>src/componentes/kit</code></span>
        </footer>
      </main>

      <AgregarRapido
        abierto={Boolean(seleccion)}
        onCerrar={() => setSeleccion(null)}
        {...(seleccion ? opcionesDeProducto(seleccion, { subproductos: SUBPRODUCTOS_DEMO }) : {})}
        onPersonalizar={() => {
          toast({ tipo: 'info', titulo: 'En la tienda iría al editor', texto: `/editor/${seleccion.id}`, duracion: 2200 });
          setSeleccion(null);
        }}
        onConfirmar={({ variante, opcion, piezas, cantidad: n }) => {
          const partes = seleccion.isComboProduct
            ? Object.values(piezas)
            : [variante && variante.name !== 'Principal' && variante.nombre !== 'Principal' ? variante.nombre : null];
          const detalle = [...partes, opcion, n > 1 ? `x${n}` : null].filter(Boolean).join(' · ');
          toast({ titulo: 'Agregado al carrito', texto: `${seleccion.name}${detalle ? ` · ${detalle}` : ''}`, imagen: variante?.imagen || seleccion.mainImage, accion: 'Ver' });
          setSeleccion(null);
        }}
      />

      <HojaInferior
        abierta={hoja}
        onCerrar={cerrarHoja}
        titulo="Personaliza tu polera"
        pie={(
          <>
            <Boton variante="contorno" onClick={cerrarHoja}>Cancelar</Boton>
            <Boton bloque brillo onClick={() => { cerrarHoja(); toast({ titulo: 'Agregado al carrito', texto: `Polera · ${talla} · ${color}`, imagen: FRENTE }); }}>
              Agregar · {soles(89.9 * cantidad)}
            </Boton>
          </>
        )}
      >
        <div className={s.columna}>
          <SelectorColor colores={COLORES_PRENDA} valor={color} onChange={setColor} />
          <SelectorTalla tallas={['XS', 'S', 'M', 'L', 'XL', 'XXL']} agotadas={['XS', 'XXL']} valor={talla} onChange={setTalla} />
          <div className={s.filaEntre}>
            <span className={s.etq}>Cantidad</span>
            <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
          </div>
        </div>
      </HojaInferior>
    </div>
  );
}

export default function ComponentesPage() {
  const [tema, setTema] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  const cambiarTema = () => {
    const nuevo = tema === 'dark' ? 'light' : 'dark';
    const aplicar = () => {
      document.documentElement.setAttribute('data-theme', nuevo);
      flushSync(() => setTema(nuevo));
    };
    try { localStorage.setItem('wala-componentes-tema', nuevo); } catch (e) { /* sin storage: solo esta visita */ }
    // View Transitions: el navegador toma una foto de la pantalla y funde las
    // dos (una sola capa en la GPU). Antes se animaba el color de cada
    // elemento a la vez y en celulares se trababa.
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reducir) document.startViewTransition(aplicar);
    else aplicar();
  };

  return (
    <MotionConfig reducedMotion="user">
      <ProveedorToasts iniciales={NOTIFICACIONES_INICIALES}>
        {/* En la app: <ProveedorEnlaces componente={Link}> (react-router). */}
        <ProveedorEnlaces componente={EnlaceDemo}>
          <Contenido tema={tema} cambiarTema={cambiarTema} />
        </ProveedorEnlaces>
      </ProveedorToasts>
    </MotionConfig>
  );
}
