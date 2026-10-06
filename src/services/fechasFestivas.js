// Calendario de fechas festivas (Día de la Madre, Navidad…): lectura/escritura
// en storeConfig/fechasFestivas. La lógica (cuándo caen, a quién le tocan) está
// en utils/fechasFestivas.mjs. storeConfig tiene lectura pública y escritura de
// admin en las reglas vivas; una colección nueva no tendría permisos.
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDocument, setDocument } from './firebase/firestore';
import {
  festivasDesdeDoc, normalizarFestiva, recordatorioPersonalDesdeDoc, normalizarDiasAviso,
} from '../utils/fechasFestivas.mjs';

const COLECCION = 'storeConfig';
const DOC_ID = 'fechasFestivas';
export const FESTIVAS_QUERY_KEY = ['fechas-festivas'];

const noExiste = (error) => /no existe|not found|no encontrado/i.test(String(error || ''));

export async function getFechasFestivas() {
  const { data, error } = await getDocument(COLECCION, DOC_ID);
  if (error && !noExiste(error)) return { data: null, error };
  return { data: festivasDesdeDoc(data), error: null };
}

// Días de aviso de las fechas de cada persona (cumpleaños, aniversario…).
export async function getRecordatorioPersonal() {
  const { data, error } = await getDocument(COLECCION, DOC_ID);
  if (error && !noExiste(error)) return { data: null, error };
  return { data: recordatorioPersonalDesdeDoc(data), error: null };
}

export async function saveRecordatorioPersonal(dias) {
  // setDocument hace merge: no toca la lista de fechas festivas.
  return setDocument(COLECCION, DOC_ID, { recordatorioPersonalDias: normalizarDiasAviso(dias) });
}

export const RECORDATORIO_QUERY_KEY = ['recordatorio-personal'];

export function useRecordatorioPersonal() {
  return useQuery({
    queryKey: RECORDATORIO_QUERY_KEY,
    queryFn: async () => (await getRecordatorioPersonal()).data || recordatorioPersonalDesdeDoc(null),
    staleTime: 30 * 60 * 1000,
  });
}

// Manda al admin (y solo a él) el mismo aviso que saldría: campanita + push.
// Sin festivaId, el de la fecha más cercana de las personas que anotó.
export async function probarAvisoFechas(festivaId) {
  try {
    const res = await httpsCallable(getFunctions(), 'probarAvisoFechas')(festivaId ? { festivaId } : {});
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'No se pudo enviar la prueba.' };
  }
}

export async function saveFechasFestivas(fechas) {
  const limpias = (fechas || []).map(normalizarFestiva).filter((f) => f.id && f.nombre);
  return setDocument(COLECCION, DOC_ID, { fechas: limpias, actualizadoEn: Date.now() });
}

// Para la web: si no se puede leer, cae a las de Perú por defecto (nunca rompe
// la página de fechas importantes).
export function useFechasFestivas() {
  return useQuery({
    queryKey: FESTIVAS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await getFechasFestivas();
      return data || festivasDesdeDoc(null);
    },
    staleTime: 30 * 60 * 1000,
  });
}
