import { db } from './firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Libreta de direcciones del cliente: un documento por cuenta (id = uid) en una
// colección que solo su dueño puede leer (regla wala_direcciones). No va en
// `users` porque esa colección la puede leer cualquier sesión del ERP.
const COLECCION = 'wala_direcciones';
export const MAX_DIRECCIONES = 10;

// Campos de una dirección: los mismos que pide el checkout.
// department/province: solo con city "Provincias" (departamento y provincia del ubigeo).
const CAMPOS = ['customerName', 'docType', 'dni', 'phone', 'country', 'city', 'department', 'province', 'district', 'address'];

const limpiar = (d) => {
  const out = { id: d.id || `dir-${Date.now().toString(36)}`, principal: !!d.principal };
  CAMPOS.forEach((c) => { out[c] = String(d[c] ?? '').trim(); });
  return out;
};

// Deja exactamente una principal (la primera marcada o, si no hay, la primera).
const normalizar = (lista) => {
  const limpia = lista.slice(0, MAX_DIRECCIONES).map(limpiar);
  const idx = Math.max(0, limpia.findIndex((d) => d.principal));
  return limpia.map((d, i) => ({ ...d, principal: i === idx }));
};

// Dos direcciones son la misma si coinciden destinatario, documento y lugar.
export const mismaDireccion = (a, b) =>
  ['customerName', 'dni', 'phone', 'city', 'department', 'province', 'district', 'address'].every(
    (c) => String(a?.[c] ?? '').trim().toLowerCase() === String(b?.[c] ?? '').trim().toLowerCase()
  );

export async function obtenerDirecciones(uid) {
  if (!uid) return [];
  const snap = await getDoc(doc(db, COLECCION, uid));
  const lista = snap.exists() ? snap.data().lista : [];
  return Array.isArray(lista) ? normalizar(lista) : [];
}

export async function guardarDirecciones(uid, lista) {
  const final = normalizar(lista);
  await setDoc(doc(db, COLECCION, uid), { lista: final, actualizado: serverTimestamp() });
  return final;
}

// Agrega una dirección (si no está repetida) y la deja principal si es la primera
// o si se pide. Devuelve la lista nueva.
export async function agregarDireccion(uid, direccion, { principal = false } = {}) {
  const actuales = await obtenerDirecciones(uid);
  if (actuales.some((d) => mismaDireccion(d, direccion))) return actuales;
  if (actuales.length >= MAX_DIRECCIONES) {
    throw new Error(`Puedes guardar hasta ${MAX_DIRECCIONES} direcciones.`);
  }
  const nueva = limpiar(direccion);
  const marcar = principal || actuales.length === 0;
  const lista = marcar
    ? [{ ...nueva, principal: true }, ...actuales.map((d) => ({ ...d, principal: false }))]
    : [...actuales, nueva];
  return guardarDirecciones(uid, lista);
}

// Cambia los datos de una dirección guardada (la misma entrada, mismo id).
export async function actualizarDireccion(uid, id, cambios) {
  const actuales = await obtenerDirecciones(uid);
  if (!actuales.some((d) => d.id === id)) return agregarDireccion(uid, cambios);
  return guardarDirecciones(uid, actuales.map((d) => (d.id === id ? { ...d, ...cambios, id, principal: d.principal } : d)));
}

export const direccionPrincipal = (lista) => lista.find((d) => d.principal) || lista[0] || null;
