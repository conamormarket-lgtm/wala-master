/**
 * Coordina el autoguardado del estudio con la lista "Tus borradores".
 *
 * Al retroceder desde el estudio, el último borrador puede seguir
 * guardándose (miniatura + Firestore). Sin esto la lista leía la versión
 * anterior y la mostraba hasta la próxima recarga.
 */

let pendientes = Promise.resolve();

/** El estudio avisa de cada guardado en curso. */
export const registrarGuardado = (promesa) => {
  pendientes = Promise.all([pendientes, Promise.resolve(promesa).catch(() => null)]);
};

/** La lista espera a que terminen antes de leer de Firestore. */
export const esperarGuardados = () => pendientes;

const clave = (uid) => ['mis-borradores-crear', uid];

/** Pone (o actualiza) un borrador al inicio de la lista en caché, sin esperar a Firestore. */
export const ponerBorradorEnCache = (queryClient, uid, borrador) => {
  queryClient.setQueryData(clave(uid), (lista) => {
    const previo = (lista || []).find((b) => b.id === borrador.id);
    const actualizado = { ...previo, ...borrador, updatedAt: { seconds: Math.floor(Date.now() / 1000) } };
    return [actualizado, ...(lista || []).filter((b) => b.id !== borrador.id)];
  });
};

/** Quita un borrador de la lista en caché (al guardarlo como creación). */
export const quitarBorradorDeCache = (queryClient, uid, id) => {
  queryClient.setQueryData(clave(uid), (lista) => (lista ? lista.filter((b) => b.id !== id) : lista));
};
