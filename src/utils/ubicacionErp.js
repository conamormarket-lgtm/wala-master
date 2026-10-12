import { getDistritos } from '../constants/peruUbigeo';

// Ubicación del checkout ("Lima" / "Callao" / "Provincias" + departamento y
// provincia del ubigeo) en el formato del ERP: departamento y provincia con su
// nombre (el ERP no entiende "Sí"/"No") y tipoEnvio, que separa Lima
// Metropolitana (delivery) de los envíos por agencia.

export const NOMBRE_CIUDAD = { Lima: 'Lima Metropolitana', Callao: 'Callao', Provincias: 'Provincias' };

/**
 * @param {{ city?: string, department?: string, province?: string }} valores
 * @returns {{ departamento: string, provincia: string, tipoEnvio: 'delivery'|'agencia', esProvincia: boolean }}
 */
export function ubicacionErp({ city, department, province } = {}) {
  if (city === 'Callao') return { departamento: 'Callao', provincia: 'Callao', tipoEnvio: 'delivery', esProvincia: false };
  if (city === 'Provincias') {
    return { departamento: String(department || '').trim(), provincia: String(province || '').trim(), tipoEnvio: 'agencia', esProvincia: true };
  }
  return { departamento: 'Lima', provincia: 'Lima Metropolitana', tipoEnvio: 'delivery', esProvincia: false };
}

/** Texto corto del lugar: "Miraflores, Lima Metropolitana" / "Yanahuara, Arequipa, Arequipa". */
export function lugarLegible({ city, district, department, province } = {}) {
  const partes = city === 'Provincias'
    ? [district, province, department]
    : [district, NOMBRE_CIUDAD[city] || city];
  return partes.map((p) => String(p || '').trim()).filter(Boolean).join(', ');
}

/** Distritos sugeridos para el campo distrito según la ciudad elegida. */
export function distritosSugeridos({ city, department, province } = {}) {
  if (city === 'Callao') return getDistritos('Callao', 'Callao');
  if (city === 'Provincias') return getDistritos(department, province);
  return getDistritos('Lima', 'Lima');
}
