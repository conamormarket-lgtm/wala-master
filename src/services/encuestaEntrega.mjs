// Resultados de la encuesta de la entrega ("¿Cómo te fue con tu pedido?") para
// /admin/encuesta-entregas. Puro: recibe lo que devuelve la function
// resultadosEncuestaEntrega ({ estrellas, mejorar, comentario, fecha… }).

const ESTRELLAS = [5, 4, 3, 2, 1];

/**
 * @param {Array} respuestas  [{ estrellas, mejorar: [texto], comentario, fecha }]
 * @param {Array} opciones    las opciones de "¿Qué podemos mejorar?" de la config
 */
export function resumenEntregas(respuestas = [], opciones = []) {
  const lista = respuestas.filter((r) => r && r.estrellas >= 1 && r.estrellas <= 5);
  const total = lista.length;
  const suma = lista.reduce((n, r) => n + r.estrellas, 0);
  const conteo = new Map(opciones.map((o) => [o, 0]));
  lista.forEach((r) => (r.mejorar || []).forEach((m) => conteo.set(m, (conteo.get(m) || 0) + 1)));
  return {
    total,
    promedio: total ? Math.round((suma / total) * 10) / 10 : 0,
    // % que puso 4 o 5 estrellas.
    contentos: total ? Math.round((lista.filter((r) => r.estrellas >= 4).length / total) * 100) : 0,
    porEstrellas: ESTRELLAS.map((n) => ({ valor: `${n} ${n === 1 ? 'estrella' : 'estrellas'}`, total: lista.filter((r) => r.estrellas === n).length })),
    mejorar: [...conteo.entries()].map(([valor, n]) => ({ valor, total: n })).sort((a, b) => b.total - a.total),
    comentarios: lista.filter((r) => String(r.comentario || '').trim()).sort((a, b) => (b.fecha || 0) - (a.fecha || 0)),
  };
}
