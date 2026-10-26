const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function crearHistorialYoryo(inicial, limite = 40) {
  let actual = inicial, antes = [], despues = [], grupo = '', momento = 0;
  return {
    get actual() { return actual; },
    get puedeDeshacer() { return antes.length > 0; },
    get puedeRehacer() { return despues.length > 0; },
    cambiar(nuevo, agrupar = '', ahora = Date.now()) {
      const valor = typeof nuevo === 'function' ? nuevo(actual) : nuevo;
      if (igual(valor, actual)) return actual;
      if (!agrupar || grupo !== agrupar || ahora - momento > 650) antes = [...antes.slice(-(limite - 1)), actual];
      actual = valor; despues = []; grupo = agrupar; momento = ahora;
      return actual;
    },
    deshacer() {
      if (!antes.length) return actual;
      despues = [actual, ...despues]; actual = antes.at(-1); antes = antes.slice(0, -1); grupo = '';
      return actual;
    },
    rehacer() {
      if (!despues.length) return actual;
      antes = [...antes, actual]; actual = despues[0]; despues = despues.slice(1); grupo = '';
      return actual;
    },
  };
}
