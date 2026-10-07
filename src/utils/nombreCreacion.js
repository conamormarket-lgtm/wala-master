/**
 * Nombre de una línea del carrito/pedido. Para una creación de Crear es el
 * nombre que le puso el cliente más la prenda ("Factos - El resultado ·
 * Polera clásica"); si su nombre ya incluye la prenda ("Polera clásica
 * calvera"), solo su nombre. Cualquier otro producto, su nombre de siempre.
 */
export const nombreConCreacion = (nombreProducto, customization) => {
  const nombre = customization?.tipo === 'crear' ? String(customization.nombre || '').trim() : '';
  const base = String(nombreProducto || '').trim();
  if (!nombre) return nombreProducto;
  if (!base || nombre.toLowerCase().includes(base.toLowerCase())) return nombre;
  return `${nombre} · ${base}`;
};
