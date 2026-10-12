import { getDistritos } from '../constants/peruUbigeo';
import { countryByCode } from '../constants/countries';

// Ubicación del checkout ("Lima" / "Callao" / "Provincias" + departamento y
// provincia del ubigeo) en el formato del ERP: departamento y provincia con su
// nombre (el ERP no entiende "Sí"/"No") y tipoEnvio, que separa Lima
// Metropolitana (delivery) de los envíos por agencia.
//
// Fuera del Perú no hay ubigeo: el cliente escribe su región (province) y su
// ciudad (district); en el ERP el "departamento" es el país y va por agencia.

export const NOMBRE_CIUDAD = { Lima: 'Lima Metropolitana', Callao: 'Callao', Provincias: 'Provincias' };

/** true si la dirección es fuera del Perú. */
export const esExtranjero = (country) => !!country && String(country).toUpperCase() !== 'PE';

const nombrePais = (country) => countryByCode(country)?.name || String(country || '').toUpperCase();

/**
 * @param {{ country?: string, city?: string, department?: string, province?: string }} valores
 * @returns {{ departamento: string, provincia: string, tipoEnvio: 'delivery'|'agencia', esProvincia: boolean }}
 */
export function ubicacionErp({ country, city, department, province } = {}) {
  if (esExtranjero(country)) {
    return { departamento: nombrePais(country), provincia: String(province || '').trim(), tipoEnvio: 'agencia', esProvincia: true };
  }
  if (city === 'Callao') return { departamento: 'Callao', provincia: 'Callao', tipoEnvio: 'delivery', esProvincia: false };
  if (city === 'Provincias') {
    return { departamento: String(department || '').trim(), provincia: String(province || '').trim(), tipoEnvio: 'agencia', esProvincia: true };
  }
  return { departamento: 'Lima', provincia: 'Lima Metropolitana', tipoEnvio: 'delivery', esProvincia: false };
}

/** Texto corto del lugar: "Miraflores, Lima Metropolitana" / "Yanahuara, Arequipa, Arequipa" / "Providencia, Santiago, Chile". */
export function lugarLegible({ country, city, district, department, province } = {}) {
  let partes;
  if (esExtranjero(country)) partes = [district, province, nombrePais(country)];
  else if (city === 'Provincias') partes = [district, province, department];
  else partes = [district, NOMBRE_CIUDAD[city] || city];
  return partes.map((p) => String(p || '').trim()).filter(Boolean).join(', ');
}

/** Distritos del lugar elegido (vacío fuera del Perú o sin provincia elegida). */
export function distritosSugeridos({ country, city, department, province } = {}) {
  if (esExtranjero(country)) return [];
  if (city === 'Callao') return getDistritos('Callao', 'Callao');
  if (city === 'Provincias') return getDistritos(department, province);
  return getDistritos('Lima', 'Lima');
}

const normLugar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** El distrito de la lista que corresponde al escrito (sin tildes: "Rímac" = "Rimac"), o ''. */
export function distritoDeLista(lugar, distrito) {
  const n = normLugar(distrito);
  return (n && distritosSugeridos(lugar).find((d) => normLugar(d) === n)) || '';
}

/**
 * ¿El distrito pertenece al lugar elegido? Sin lista para ese lugar (extranjero o
 * aún sin provincia) o sin distrito, no hay nada que contradecir.
 */
export function distritoEnLugar(lugar, distrito) {
  if (!distrito || distritosSugeridos(lugar).length === 0) return true;
  return !!distritoDeLista(lugar, distrito);
}
