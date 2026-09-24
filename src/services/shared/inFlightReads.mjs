// Comparte únicamente solicitudes EN CURSO. No añade TTL ni sirve resultados
// guardados: la siguiente lectura vuelve a consultar la fuente.
export function createInFlightReads() {
  const pending = new Map();
  return {
    run(key, load) {
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve().then(load).finally(() => {
        // Una invalidación puede haber iniciado una solicitud más reciente.
        if (pending.get(key) === promise) pending.delete(key);
      });
      pending.set(key, promise);
      return promise;
    },
    clear() {
      pending.clear();
    },
  };
}
