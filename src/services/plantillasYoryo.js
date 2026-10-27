import { getDocument, setDocument } from './firebase/firestore';
import { validarPresetYoryo } from '../utils/capasYoryo.mjs';

// Colección existente: lectura pública y escritura solo de administradores.
const DOCUMENTO = 'yoryo-composiciones-v4';
export async function obtenerPlantillasYoryo() {
  const r = await getDocument('templates', DOCUMENTO);
  if (r.error === 'Documento no encontrado') return {};
  if (r.error) throw new Error(`No pudimos cargar las plantillas: ${r.error}`);
  return r.data?.presets || {};
}
export async function guardarPlantillaYoryo(preset) {
  validarPresetYoryo(preset);
  // merge de una única clave: no pisa las composiciones de otros equipos.
  const r = await setDocument('templates', DOCUMENTO, { tipo: 'yoryo-composiciones', presets: { [preset.clave]: preset } });
  if (r.error) throw new Error(r.error);
}
