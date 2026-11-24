// Propuesta de contenido local. Utiliza el mismo esquema editable que Walá.
// Los archivos se preparan con scripts/prepare-consul-media.py. El publicador
// convierte estas rutas locales a Storage antes de guardar el producto.
export const CONSUL_PRODUCT_ID = 'yoryo-crear-billetera';
const root = '/output/product-media/consul';
const image = path => `${root}/${path}.webp`;
const video = id => `${root}/videos/${id}.mp4`;
const poster = id => `${root}/videos/${id}.webp`;
const colors = [
  { key: 'azul', id: 'variant_1790092445170_b1_0', name: 'Deep Blue', videos: ['G-AZ-01', 'G-AZ-02'] },
  { key: 'marron', id: 'variant_1790093590594_bil_0', name: 'Marrón Coñac', videos: ['G-MA-01', 'G-MA-02'] },
  { key: 'negro', id: 'variant_1790093590594_bil_1', name: 'Negro Azabache', videos: ['G-NE-01'] },
];
const gallery = ['07-presentacion', '01-catalogo', '10-interior', '11-tarjetero', '06-uso-cotidiano', '08-cremallera', '09-diagonal', '02-catalogo', '03-catalogo', '04-catalogo', '05-catalogo', '12-ventana-documento', '13-en-mano', '14-escritorio'];
const shotNames = ['Textura y cremallera', 'Organización interior', 'En tu día a día'];
const reelMedia = colors.flatMap((color, index) => [1, 2, 3].map(n => {
  const id = `R-${index + 1}-0${n}`;
  return { id, type: 'video', url: video(id), poster: poster(id), alt: `${shotNames[n - 1]} · ${color.name}`, caption: color.name, ratio: 'story', fit: 'contain', autoPlay: true, muted: true, loop: true };
}));

export function consulLocalProduct(base) {
  return {
    ...base,
    images: [], mainImage: '',
    description: '<p>Yoryo Cónsul: tres colores, organización interior y un diseño que puedes hacer tuyo. Explora las fotos y elige entre Deep Blue, Marrón Coñac y Negro Azabache.</p>',
    variants: colors.map(color => {
      const images = [...gallery, ...(color.key !== 'negro' ? ['15-vertical-flow'] : [])].map(name => image(`galeria/${color.key}/${name}`));
      return { ...base.variants.find(v => v.id === color.id), imageUrl: images[0], images: images.slice(1), galleryImages: images.slice(1) };
    }),
    videos: colors.flatMap(color => color.videos.map((id, index) => ({ url: video(id), poster: poster(id), name: `${color.name} · ${index ? 'Interior' : 'Presentación'}`, variantId: color.id, afterImage: index ? 3 : 1, autoPlay: false, muted: true, loop: true }))),
    detailComposition: {
      version: 1, visible: true, heading: 'Conoce tu próxima billetera', eyebrow: 'Yoryo Cónsul · A tu manera',
      commerce: {
        primaryAction: 'add', subtitle: 'Para lo que llevas contigo. Y para lo que te hace único.',
        highlights: [{ id: 'interior', text: 'Tarjetero, ventana interior y bolsillo con cremallera' }, { id: 'colores', text: 'Tres colores para elegir tu estilo' }, { id: 'personaliza', text: 'Cómprala tal cual o prepara tu personalización' }],
        priceNote: 'Elige tu color y revisa las opciones de personalización.',
        personalizationNote: 'Prepara tu diseño en el personalizador y revisa los textos, las imágenes y su ubicación antes de continuar.',
        paymentNote: 'Revisa el total y las opciones de pago al finalizar tu pedido.',
        steps: [{ id: 'color', text: 'Elige el color que más va contigo.' }, { id: 'diseno', text: 'Añádela tal cual o prepara tu diseño.' }, { id: 'pedido', text: 'Revisa tu carrito y completa la entrega.' }],
        informationTitle: 'Características',
        information: 'Conoce la distribución de la Yoryo Cónsul y elige el color que va contigo.',
        specifications: [
          { id: 'modelo', label: 'Modelo', value: 'Yoryo Cónsul' },
          { id: 'formato', label: 'Formato', value: 'Billetera de tres cuerpos' },
          { id: 'organizacion', label: 'Organización', value: 'Tarjetero, ventana para documento y bolsillo con cremallera' },
          { id: 'colores', label: 'Colores', value: 'Deep Blue, Marrón Coñac y Negro Azabache' },
          { id: 'personalizacion', label: 'Personalización', value: 'Opcional, desde el personalizador de Walá' },
        ],
        warrantyTitle: 'Garantía y cambios',
        warranty: 'Si tu producto llega defectuoso, dañado o con un estampado claramente diferente al diseño final aprobado, contáctanos dentro de los 7 días posteriores a la entrega para gestionar un reemplazo o reembolso, según las condiciones de Walá.\n\nEn productos personalizados no se aceptan devoluciones por cambio de opinión o por errores del cliente al elegir talla o color.',
        policyUrl: '/terminos-y-condiciones',
        deliveryTitle: 'Tiempo de entrega',
        delivery: 'Revisa el plazo estimado al completar tu compra. La fecha depende del destino y de las opciones de tu pedido. Si necesitas recibirla para una fecha especial, consúltanos por WhatsApp antes de confirmar.',
        showShippingRate: true,
        faqMode: 'custom', faqTitle: 'Antes de hacerla tuya',
        faqs: [
          { id: 'sin-diseno', question: '¿Puedo comprarla sin personalizar?', answer: 'Sí. Elige tu color y añádela al carrito. La opción Personalizar está disponible si quieres preparar un diseño.' },
          { id: 'revisar', question: '¿Qué debo revisar en mi diseño?', answer: 'Comprueba nombres, tildes, fechas y la posición de tus imágenes. La vista del personalizador te ayuda a revisar la composición antes de continuar.' },
          { id: 'entrega', question: '¿Cómo reviso la entrega y el total?', answer: 'En el checkout puedes completar tus datos y revisar la entrega, los medios de pago y el resumen del pedido antes de confirmar.' },
          { id: 'colores', question: '¿Las fotos cambian con el color?', answer: 'Sí. La galería principal muestra las fotos y los vídeos del color seleccionado. En las secciones de inspiración puedes comparar los tres colores.' },
        ],
        showReviews: true, showRelated: true, showSticky: true, showTrust: true,
        storyMediaId: 'en-movimiento:R-1-01',
      },
      blocks: [
        { id: 'en-movimiento', kind: 'carousel', title: 'Así se ve, de cerca', text: 'Recorre los detalles y encuentra tu color favorito.', columns: 4, mobileColumns: 1, width: 'wide', align: 'center', ratio: 'story', fit: 'contain', media: reelMedia },
        { id: 'cada-detalle', kind: 'mosaic', title: 'Un lugar para lo que importa', text: 'Mira la textura, la cremallera y la distribución interior.', width: 'wide', align: 'center', mosaicLayout: 'flexible', mosaicSizing: 'proportional', columns: 3, mobileColumns: 1, ratio: 'landscape', fit: 'contain', media: [
          ['01-mosaico-textura', 'Textura y cremallera'], ['02-mosaico-interior', 'Distribución interior'], ['03-mosaico-tarjetero', 'Detalle del tarjetero'],
        ].map(([name, alt], index) => ({ id: name, type: 'image', url: image(`compartidas/${name}`), mobileUrl: image(`movil/${name}`), alt, ratio: 'auto', fit: 'contain', cell: { width: index === 0 ? 2 : 1, height: 1, mobileWidth: 1, mobileHeight: 1 } })) },
        { id: 'hazla-tuya', kind: 'gallery', title: 'Tu diseño empieza aquí', text: 'Explora el personalizador y prepara una composición con significado para ti.', columns: 2, mobileColumns: 1, width: 'normal', align: 'center', ratio: 'auto', fit: 'contain', media: [
          { id: 'editor-real', type: 'image', url: image('compartidas/05-personalizador-real-wala'), alt: 'Personalizador de Walá', caption: 'Vista del personalizador de Walá.', ratio: 'auto', fit: 'contain' },
          { id: 'concepto', type: 'image', url: image('compartidas/06-personalizacion-concepto'), alt: 'Idea de billetera personalizada', caption: 'Concepto visual generado con IA. Referencia de diseño, no muestra de un grabado fabricado.', ratio: 'portrait', fit: 'contain' },
        ] },
        { id: 'para-regalar', kind: 'split', title: 'Un detalle que va contigo', text: 'Para ti o para alguien especial. Elige su color favorito y dale un toque personal con tu diseño.', side: 'left', width: 'normal', ratio: 'portrait', fit: 'contain', media: [{ id: 'regalo', type: 'image', url: image('compartidas/04-regalo-ambiente'), alt: 'Billetera Yoryo Cónsul en un ambiente de regalo', ratio: 'portrait', fit: 'contain' }] },
      ],
    },
  };
}
