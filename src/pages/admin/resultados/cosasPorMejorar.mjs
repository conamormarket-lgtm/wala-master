// "Cosas por mejorar" del Resumen de Resultados: reglas simples sobre los datos
// del rango que el dueño de la tienda puede entender y accionar. Pura: recibe
// lo que ya trae el resumen diario y devuelve avisos ordenados por urgencia.
//
// Cada aviso: { id, nivel: 'alta'|'media'|'baja', titulo, texto, destino }
// destino: a qué parte de Resultados lleva ('productos'|'clientes'|'enlaces'|'visitantes').

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const total = (taw) => num(taw && typeof taw === 'object' ? taw.total : taw);
const soles = (cents) => `S/ ${(num(cents) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ORDEN = { alta: 0, media: 1, baja: 2 };

// Umbrales: por debajo de esto no hay datos suficientes para decir algo.
export const UMBRALES = {
  vistasProducto: 20,       // vistas para considerar "muy visto"
  ventasMaxPocoVendido: 1,  // hasta cuántas unidades se considera "casi no se vende"
  baseEmbudo: 5,            // personas mínimas en un paso para hablar de caída
  caidaEmbudo: 50,          // % de caída a partir del que se avisa
  busquedasMin: 5,          // veces que se buscó algo para mencionarlo
  visitasRebote: 20,        // visitas mínimas para hablar de rebote
  rebote: 70,               // % de visitas sin interacción
};

/**
 * @param {object} d
 * @param {Array}  d.masVistos       [{ productId, name, total }]   vistas por producto
 * @param {Array}  d.topVendidos     [{ productId, unidades }]
 * @param {object} d.carritos        { cantidad: TAW, valorCents: TAW }
 * @param {object} d.embudo          { adds, checkouts, purchases } (TAW o número)
 * @param {Array}  d.busquedas       [{ query, total }]
 * @param {number} d.enlacesRotos    direcciones rotas que recibieron visitas
 * @param {object} d.visitas         { total: TAW, conInteraccion: TAW }
 * @param {Map|object} d.nombres     productId -> nombre (opcional)
 */
export function cosasPorMejorar(d = {}) {
  const avisos = [];
  const nombreDe = (id, fallback) => {
    const n = d.nombres instanceof Map ? d.nombres.get(id) : d.nombres?.[id];
    return n || fallback || 'Un producto';
  };

  // 1. Muy vistos y casi sin ventas (máximo dos, los más vistos).
  const vendidas = new Map((d.topVendidos || []).map((p) => [p.productId, num(p.unidades)]));
  (d.masVistos || [])
    .filter((p) => num(p.total) >= UMBRALES.vistasProducto && (vendidas.get(p.productId) || 0) <= UMBRALES.ventasMaxPocoVendido)
    .sort((a, b) => num(b.total) - num(a.total))
    .slice(0, 2)
    .forEach((p) => {
      const ventas = vendidas.get(p.productId) || 0;
      avisos.push({
        id: `poco-vendido-${p.productId}`,
        nivel: 'alta',
        titulo: `${nombreDe(p.productId, p.name)}: ${num(p.total)} vistas y ${ventas} ${ventas === 1 ? 'venta' : 'ventas'}`,
        texto: 'Mucha gente lo mira y casi nadie lo compra. Revisa el precio, las fotos o las tallas.',
        destino: 'productos',
      });
    });

  // 2. Carritos abandonados.
  const nCarritos = total(d.carritos?.cantidad);
  if (nCarritos > 0) {
    avisos.push({
      id: 'carritos',
      nivel: nCarritos >= 3 ? 'alta' : 'media',
      titulo: `${nCarritos} ${nCarritos === 1 ? 'carrito abandonado' : 'carritos abandonados'} por ${soles(total(d.carritos?.valorCents))}`,
      texto: 'Agregaron productos y no terminaron el pedido. Escríbeles a los que tienen cuenta.',
      destino: 'clientes',
    });
  }

  // 3. El paso del recorrido donde más gente se va (carrito → pagar → pedido).
  const pasos = [
    { de: total(d.embudo?.adds), a: total(d.embudo?.checkouts), texto: (n) => `De cada 10 que agregan al carrito, ${n} no llegan a pagar`, consejo: 'Revisa el costo de envío y que el carrito se entienda.' },
    { de: total(d.embudo?.checkouts), a: total(d.embudo?.purchases), texto: (n) => `De cada 10 que llegan a pagar, ${n} no terminan`, consejo: 'Revisa los medios de pago y que el formulario no pida de más.' },
  ]
    .filter((p) => p.de >= UMBRALES.baseEmbudo)
    .map((p) => ({ ...p, caida: Math.round(((p.de - Math.min(p.a, p.de)) / p.de) * 100) }))
    .filter((p) => p.caida >= UMBRALES.caidaEmbudo)
    .sort((a, b) => b.caida - a.caida);
  if (pasos[0]) {
    avisos.push({
      id: 'embudo',
      nivel: 'media',
      titulo: pasos[0].texto(Math.round(pasos[0].caida / 10)),
      texto: pasos[0].consejo,
      destino: 'productos',
    });
  }

  // 4. Muchas visitas que se van sin hacer nada.
  const visitas = total(d.visitas?.total);
  if (visitas >= UMBRALES.visitasRebote) {
    const rebote = Math.round(((visitas - total(d.visitas?.conInteraccion)) / visitas) * 100);
    if (rebote >= UMBRALES.rebote) {
      avisos.push({
        id: 'rebote',
        nivel: 'media',
        titulo: `De cada 10 visitas, ${Math.round(rebote / 10)} se van sin hacer nada`,
        texto: 'Miran una sola página y se van. Revisa lo primero que ven: la portada o la página del anuncio.',
        destino: 'visitantes',
      });
    }
  }

  // 5. Lo más buscado.
  const busqueda = [...(d.busquedas || [])].sort((a, b) => num(b.total) - num(a.total))[0];
  if (busqueda && num(busqueda.total) >= UMBRALES.busquedasMin) {
    avisos.push({
      id: 'busqueda',
      nivel: 'baja',
      titulo: `Buscaron "${busqueda.query}" ${num(busqueda.total)} veces`,
      texto: 'Asegúrate de que se encuentre fácil o de tenerlo en la tienda.',
      destino: 'productos',
    });
  }

  // 6. Direcciones que no existen y recibieron visitas.
  const rotos = num(d.enlacesRotos);
  if (rotos > 0) {
    avisos.push({
      id: 'enlaces',
      nivel: 'baja',
      titulo: `${rotos} ${rotos === 1 ? 'dirección que no existe recibió' : 'direcciones que no existen recibieron'} visitas`,
      texto: 'Vienen de un anuncio, un QR o una página borrada. Llévalas a una página que exista.',
      destino: 'enlaces',
    });
  }

  return avisos.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
}
