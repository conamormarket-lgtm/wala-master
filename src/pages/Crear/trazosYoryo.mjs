// Serializa los comandos originales sin simplificar contornos. La rutina de
// redondeo de OpenType 2 puede producir NaN con decimales cercanos a un entero
// (por ejemplo 80.00000000000001), truncando letras en el SVG del navegador.
export function serializarTrazos(path) {
  const coordenadas = { M: ['x', 'y'], L: ['x', 'y'], Q: ['x1', 'y1', 'x', 'y'], C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'], Z: [] };
  return path.commands.map((comando) => {
    const claves = coordenadas[comando.type];
    if (!claves) throw new Error('No pudimos preparar los trazos de esta letra.');
    const valores = claves.map((clave) => {
      const numero = comando[clave];
      if (!Number.isFinite(numero)) throw new Error('No pudimos preparar todos los trazos de esta letra. Elige otro estilo.');
      return String(Number(numero.toFixed(3)));
    });
    return comando.type + valores.join(' ');
  }).join('');
}
