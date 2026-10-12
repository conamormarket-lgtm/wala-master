import React, { useState } from 'react';
import { RenderSecciones, ESQUEMAS, GRUPOS_MODULOS, Pestanas } from './kit';
import s from './DemoSecciones.module.css';

/*
 * Catálogo de secciones del builder: cada tipo por separado, con su nombre,
 * su `type` (como se guarda en Firestore) y sus variantes. Los ajustes son
 * los mismos campos que guarda el editor. Las secciones de la landing del
 * reloj (conversion_fold, landing_payment) no están en el kit.
 */

const VIDEO_DEMO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

/** Ejemplos por tipo: [{ nombre de la variante, settings }]. */
const ejemplos = (img) => ({
  announcement_bar: [
    ['Suave', { variant: 'soft', bgColor: '#7c3aed', density: 'comfortable', messages: [{ text: '🎁 Envoltura de regalo gratis este mes', link: '/conamor' }, { text: '🚚 Envíos a todo el Perú', link: '' }] }],
    ['Sólida', { variant: 'solid', bgColor: '#6d28d9', textColor: '#ffffff', messages: [{ text: '⚡ Ofertas relámpago solo por hoy', link: '#ofertas' }, { text: '💳 Paga con Yape o tarjeta', link: '' }] }],
    ['Oscura', { variant: 'dark', bgColor: '#db2777', messages: [{ text: '💜 Usa WALA10 y ahorra S/ 10 en tu primera compra', link: '/tienda' }] }],
    ['Cinta', { variant: 'solid', bgColor: '#0f766e', animationType: 'scroll', messages: [{ text: '🚚 Envíos a todo el Perú' }, { text: '🎨 Diseña tu polera en 2 minutos' }, { text: '⭐ Más de 10 mil pedidos entregados' }] }],
  ],
  hero_carousel: [
    ['Carrusel', {
      slides: [
        { imageUrl: '/crear/banner-crear-1200.webp', mobileImageUrl: '/crear/banner-crear-movil.webp', title: 'Diseña tu polera en 2 minutos', subtitle: 'Sube tu foto, escribe tu frase y nosotros la estampamos.', buttonText: 'Empezar a crear', buttonLink: '/personalizar', contentPosition: 'left', overlayColor: '#1e1b2e', overlayOpacity: 35, buttonBgColor: '#ffffff', buttonTextColor: '#4c1d95' },
        { imageUrl: '/assets/kapi/banners/ruleta.webp', title: 'Gira la ruleta de Kapi', subtitle: 'Gana monedas y cupones todos los días.', buttonText: 'Jugar', buttonLink: '/minijuegos', contentPosition: 'left', overlayOpacity: 25 },
      ],
      autoPlay: false, showArrows: true, showDots: true, heightDesktop: '380px', heightMobile: '300px', borderRadius: '20px',
    }],
  ],
  hero_banner: [
    ['Imagen', { mediaType: 'image', mediaUrl: '/crear/banner-crear-1200.webp', eyebrow: 'Con Amor', title: 'Regalos que se recuerdan', subtitle: 'Tu foto, tu frase y nuestro taller. Listo en 48 horas.', buttonText: 'Crear el mío', buttonLink: '/personalizar', textAlign: 'left', overlayOpacity: 55, minHeight: '420px' }],
    ['Centrado', { mediaType: 'image', mediaUrl: '/assets/kapi/banners/alimenta.webp', title: 'Kapi tiene hambre', subtitle: 'Juega, gana monedas y canjéalas por descuentos.', buttonText: 'Jugar ahora', buttonLink: '/minijuegos', textAlign: 'center', textPosition: 'flex-end', overlayOpacity: 45, minHeight: '380px' }],
  ],
  header: [
    ['Centrado', { eyebrow: 'Nuestro taller', title: 'Hecho en Perú, con amor', titleHighlight: 'con amor', subtitle: 'Cada pedido se estampa a mano en nuestro taller de Lima.', textAlign: 'center', buttonText: 'Conoce el taller', buttonLink: '/nosotros' }],
    ['A la izquierda', { title: 'Regalos para parejas', subtitle: 'Poleras, tazas y cuadros que combinan.', textAlign: 'left' }],
  ],
  text: [
    ['Texto', { heading: 'Cómo cuidamos tu pedido', content: 'Revisamos tu diseño antes de estamparlo y te escribimos si algo no se verá bien.\nEmpacamos cada prenda en papel de seda y la enviamos con seguimiento.', textAlign: 'left', maxWidth: '720px', buttonText: 'Ver preguntas frecuentes', buttonLink: '#faq' }],
  ],
  image: [
    ['Imagen con enlace', { url: '/assets/kapi/banners/bolitas.webp', alt: 'Juega a las bolitas de Kapi', link: '/minijuegos', maxWidth: '960px', borderRadius: '20px' }],
  ],
  video: [
    ['YouTube', { url: VIDEO_DEMO, aspectRatio: '16:9' }],
  ],
  featured_products: [
    ['Cuadrícula', { eyebrow: 'Elegidos por ti', title: 'Productos destacados', buttonText: 'Ver todo', buttonLink: '/tienda' }],
  ],
  featured_carousel: [
    ['Carrusel', { eyebrow: 'Favoritos de la semana', title: 'Lo más pedido', visibleItems: 4, buttonText: 'Ver todo', buttonLink: '/tienda' }],
  ],
  new_arrivals_carousel: [['Carrusel', { eyebrow: 'Recién llegados', title: 'Novedades', visibleItems: 4 }]],
  sale_carousel: [['Carrusel', { title: 'Ofertas', visibleItems: 4, buttonText: 'Ver ofertas', buttonLink: '/ofertas' }]],
  category_carousel: [['Carrusel', { title: 'Poleras', visibleItems: 4, categoryId: 'poleras' }]],
  collection_carousel: [['Carrusel', { title: 'Colección San Valentín', collection: 'san-valentin', visibleItems: 4 }]],
  flash_sales: [
    ['Evento', { title: 'Ofertas relámpago', subtitle: 'Precios que se van a medianoche.', endTime: new Date(Date.now() + 5 * 3600 * 1000 + 17 * 60 * 1000).toISOString() }],
  ],
  bestsellers_row: [
    ['Fila', {
      title: 'Los más regalados',
      cards: [
        { id: 'c1', title: 'Polera con tu foto', subtitle: 'Estampado de alta duración', imageUrl: img.frente, link: '/tienda?categoria=poleras' },
        { id: 'c2', title: 'Taza mágica', subtitle: 'Aparece el diseño con el calor', imageUrl: img.taza, link: '/tienda?categoria=tazas' },
        { id: 'c3', title: 'Kapi de peluche', subtitle: 'Suave y con lazo', imageUrl: '/assets/kapi/kapi-happy.webp', link: '/kapi' },
        { id: 'c4', title: 'Cuadro decorativo', subtitle: 'Tu foto en lienzo', imageUrl: img.cuadro, link: '/tienda?categoria=cuadros' },
        { id: 'c5', title: 'Para parejas', subtitle: 'Diseños que combinan', imageUrl: img.espalda, link: '/tienda?categoria=parejas' },
      ],
    }],
  ],
  product_grid: [['Todos', { title: 'Toda la tienda' }]],
  sidebar_catalog: [['Con filtros', { title: 'Catálogo Con Amor' }]],
  category_grid: [
    ['Cuadros', { title: '¿Qué estás buscando?', dataSource: 'manual', columns: 6, cardStyle: 'compact' }],
    ['Círculos', { title: '¿Qué estás buscando?', dataSource: 'manual', columns: 6, cardStyle: 'round' }],
  ],
  categories_nav: [['Burbujas', { brandId: 'conamor', align: 'center' }], ['Cinta', { brandId: 'conamor', animation: 'slider' }]],
  banner_grid: [
    ['Marcas', { dataSource: 'brands', title: 'Explora nuestros mundos', subtitle: 'Encuentra productos de tus marcas favoritas', columns: 3, brandCardStyle: 'editorial', autoPlay: false }],
    ['Marcas con borde', { dataSource: 'brands', title: 'Explora nuestros mundos', columns: 3, brandCardStyle: 'outline', autoPlay: false }],
    ['Banners a mano', {
      dataSource: 'manual', title: 'Juega con Kapi', columns: 2,
      items: [
        { imageUrl: '/assets/kapi/banners/ruleta.webp', link: '/minijuegos', alt: 'Ruleta de Kapi' },
        { imageUrl: '/assets/kapi/banners/palabra.webp', link: '/minijuegos', alt: 'Palabra del día' },
      ],
    }],
  ],
  trust_badges: [
    ['Insignias', { badges: [{ icon: 'truck', text: 'Envío a todo el Perú' }, { icon: 'shield', text: 'Pago seguro' }, { icon: 'return', text: 'Cambios fáciles' }, { icon: 'heart', text: 'Hecho con amor' }] }],
  ],
  testimonials: [
    ['Opiniones', {
      eyebrow: 'Clientes felices', title: 'Lo que dicen nuestros clientes',
      testimonials: [
        { topic: 'Calidad del producto', text: 'La polera llegó igualita al diseño y la tela es súper suave. Ya pedí otra para mi hermana.', author: 'Andrea P.', city: 'Lima', rating: 5, verified: true },
        { topic: 'Regalo', text: 'Le regalé la taza a mi mamá con nuestra foto y lloró de emoción. Llegó en 3 días.', author: 'Luis R.', city: 'Arequipa', rating: 5, verified: true },
        { topic: 'Atención', text: 'Me ayudaron por WhatsApp a ajustar mi diseño. Muy buena atención.', author: 'Camila T.', city: 'Trujillo', rating: 4 },
        { topic: 'Envío', text: 'Pensé que demoraría más a provincia, pero llegó rapidísimo y bien empacado.', author: 'Jorge M.', city: 'Cusco', rating: 5, verified: true },
      ],
    }],
  ],
  marquee: [
    ['Logos', {
      title: 'Nuestras marcas', speed: 25000,
      items: [
        { imageUrl: '/marcas/con-amor.png', name: 'Con Amor', link: '/conamor', shape: 'circle' },
        { imageUrl: '/marcas/catas.png', name: 'Catas', link: '/catas', shape: 'square' },
        { imageUrl: '/logo-wala-192.png', name: 'Walá', link: '/', shape: 'circle' },
        { imageUrl: '/assets/kapi/kapi-happy.webp', name: 'Kapi', link: '/kapi', shape: 'circle' },
      ],
    }],
  ],
  feature_list: [
    ['Con foto', {
      eyebrow: 'Hecho a mano', title: '¿Por qué elegirnos?', subtitle: 'Lo que nos dicen que nos hace distintos.', imageUrl: img.espalda, imageAlt: 'Recién salida del taller',
      items: [{ icon: 'paleta', text: 'Estampado que no se cuartea al lavar' }, { icon: 'camion', text: 'Envío a todo el Perú' }, { icon: 'chat', text: 'Te ayudamos con tu diseño por WhatsApp' }],
      quote: 'Pedí tres poleras para el cumple de mi papá y llegaron perfectas.', quoteAuthor: 'Andrea, Lima',
    }],
    ['Sin foto', { title: 'Tu regalo, sin complicaciones', items: [{ icon: 'regalo', text: 'Envoltura de regalo' }, { icon: 'reloj', text: 'Listo en 48 horas' }, { icon: 'cambio', text: 'Cambios fáciles' }] }],
  ],
  faq_accordion: [
    ['Título al lado', {
      eyebrow: '¿Dudas?', title: 'Preguntas frecuentes', subtitle: 'Resolvemos las dudas más comunes antes de tu compra.', layout: 'split', defaultOpen: true,
      items: [
        { id: 'f1', question: '¿Realizan envíos a todo el Perú?', answer: 'Sí. Atendemos pedidos para Lima y provincias. El costo y el plazo se confirman según el destino.' },
        { id: 'f2', question: '¿Cuánto demora un producto personalizado?', answer: 'Depende del producto y la cantidad. Te confirmamos el plazo antes de empezar.' },
        { id: 'f3', question: '¿Puedo pedir un cambio o devolución?', answer: 'Si llega con un error o daño, escríbenos con tu número de pedido y fotos.' },
      ],
    }],
    ['Título arriba', {
      title: 'Preguntas frecuentes', layout: 'top',
      items: [
        { id: 'f1', question: '¿Cómo personalizo mi producto?', answer: 'Desde Crear subes tu foto o texto y ves cómo queda al instante.' },
        { id: 'f2', question: '¿Qué medios de pago aceptan?', answer: 'Tarjeta, Yape y PayPal.' },
      ],
    }],
  ],
  map_location: [
    ['Mapa a la derecha', { eyebrow: 'Nuestra tienda', title: 'Visítanos en Lima', description: 'Av. Ejemplo 123, Miraflores\nLunes a sábado de 10 a. m. a 7 p. m.', embedUrl: 'https://www.google.com/maps?q=Miraflores,Lima,Peru&output=embed', layout: 'mapRight', mapWidth: '55%', mapHeight: '320px', buttonText: 'Escríbenos', buttonLink: 'https://wa.me/51900000000' }],
  ],
  footer_columns: [
    ['Columnas', {
      columns: [
        { id: 'c1', title: 'Walá', type: 'text', content: 'Prendas y regalos personalizados con amor y dedicación.' },
        { id: 'c2', title: 'Tienda', type: 'links', links: [{ text: 'Catálogo', url: '/tienda' }, { text: 'Crear', url: '/personalizar' }, { text: 'Mi cuenta', url: '/cuenta' }] },
        { id: 'c3', title: 'Síguenos', type: 'social', links: [{ text: 'Instagram', url: 'https://instagram.com/wala.pe' }, { text: 'TikTok', url: 'https://tiktok.com/@wala.pe' }, { text: 'WhatsApp', url: 'https://wa.me/51900000000' }] },
      ],
    }],
  ],
});

/** Índice del catálogo (para la barra de arriba). */
export const GRUPOS_CATALOGO = GRUPOS_MODULOS.map((g) => [`g-${g.toLowerCase().replace(/[^a-z]/g, '')}`, g]);

function Ficha({ tipo, variantes, datos }) {
  const esquema = ESQUEMAS[tipo];
  const Icono = esquema.icono;
  const [i, setI] = useState(0);
  const [categoria, setCategoria] = useState(null);
  const ajustes = variantes[i][1];

  const propsPara = (sec) => {
    if (sec.type === 'categories_nav') return { activa: categoria, onSeleccionar: setCategoria };
    if (sec.type === 'sidebar_catalog') return { grupos: datos.grupos };
    return undefined;
  };
  const productosPara = (sec) => {
    if (sec.type === 'flash_sales') return datos.productos.filter((p) => ['essentials', 'taza', 'kapi', 'combo', 'cuadro'].includes(p.id));
    if (sec.type === 'sale_carousel') return datos.productos.filter((p) => p.salePrice);
    return datos.productos;
  };
  const categoriasPara = (sec) => (sec.type === 'category_grid' ? undefined : datos.categorias);

  return (
    <article id={`t-${tipo}`} className={s.ficha}>
      <header className={s.fichaCabeza}>
        <span className={s.fichaIcono}><Icono aria-hidden="true" /></span>
        <div className={s.fichaTextos}>
          <h3>{esquema.nombre}</h3>
          <p>{esquema.descripcion}</p>
        </div>
        <code className={s.fichaTipo}>{tipo}</code>
      </header>
      {variantes.length > 1 && (
        <div className={s.fichaVariantes}>
          <Pestanas opciones={variantes.map(([nombre], k) => ({ id: String(k), texto: nombre }))} valor={String(i)} onChange={(v) => setI(Number(v))} etiqueta={`Variantes de ${esquema.nombre}`} />
        </div>
      )}
      <div className={s.fichaLienzo}>
        <RenderSecciones
          key={i}
          secciones={[{ id: `${tipo}-${i}`, type: tipo, order: 0, settings: { ...ajustes, items: ajustes.items ?? (tipo === 'category_grid' ? datos.categorias : undefined) } }]}
          productosPara={productosPara}
          categoriasPara={categoriasPara}
          marcasPara={() => datos.marcas}
          propsPara={propsPara}
          onAgregar={datos.onAgregar}
        />
      </div>
    </article>
  );
}

/**
 * Todas las secciones del builder, agrupadas como en el catálogo del editor.
 *  - datos: { productos, categorias, marcas, grupos, imagenes, onAgregar }
 */
export default function DemoSecciones({ datos }) {
  const lista = ejemplos(datos.imagenes);
  return (
    <div className={s.catalogo}>
      {GRUPOS_MODULOS.map((g, k) => {
        const tipos = Object.keys(ESQUEMAS).filter((t) => ESQUEMAS[t].grupo === g && lista[t]);
        if (!tipos.length) return null;
        return (
          <section key={g} id={GRUPOS_CATALOGO[k][0]} className={s.grupo}>
            <header className={s.grupoCabeza}>
              <h2>{g}</h2>
              <span>{tipos.length} {tipos.length === 1 ? 'sección' : 'secciones'}</span>
            </header>
            <div className={s.fichas}>
              {tipos.map((t) => <Ficha key={t} tipo={t} variantes={lista[t]} datos={datos} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
