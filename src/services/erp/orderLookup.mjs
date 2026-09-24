// Cada colección conserva su fallback histórico. Las colecciones independientes
// se consultan juntas, sin lanzar las consultas de fallback si ya hubo resultados.
export async function readOrdersByDocument(read, dniRaw, dniNorm) {
  const values = [...new Set([dniNorm, dniRaw].filter(Boolean))];
  const lists = await Promise.all(['pedidos', 'pedidos_web'].map(async (name) => {
    for (const value of values) {
      for (const field of ['clienteNumeroDocumento', 'dni']) {
        const orders = await read(name, field, value);
        if (orders.length) return orders;
      }
    }
    return [];
  }));
  return lists.flat();
}
