// NOMBRES PROPIOS QUE NUNCA SE TRADUCEN
//
// Los nombres de marca son nombres propios: "Nova" no es "New" ni "Catas" es
// "Tastings". Se quitaron los <T> de los sitios donde se pintan sueltos, pero
// eso no basta: el TITULO del hero de una pagina de marca ES el nombre de la
// marca, escrito como un texto normal del builder, y por ahi volvia a salir
// traducido ("CON AMOR GEEKS" -> "WITH LOVE GEEKS").
//
// Por eso la regla la aplica el traductor (translate.js pregunta aqui antes de
// traducir), y no cada componente: da igual por donde llegue el texto, si es un
// nombre de marca se devuelve tal cual. Es un modulo aparte para no descargar
// el traductor en espanol. La lista la registra quien ya tiene las marcas
// cargadas (el Header), asi no hace falta una lectura nueva.
const textosSinTraducir = new Set();

// Se compara sin mayusculas, sin acentos y sin espacios de mas: el hero escribe
// el nombre en MAYUSCULAS y aun asi debe reconocerse.
const normalizarParaComparar = (t) => String(t || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

/**
 * Registra textos que no deben traducirse nunca (nombres de marca).
 * Acumulativo e idempotente: se puede llamar cada vez que cambie la lista.
 */
export function registrarTextosSinTraducir(lista) {
  for (const t of (Array.isArray(lista) ? lista : [])) {
    const n = normalizarParaComparar(t);
    if (n) textosSinTraducir.add(n);
  }
}

/** Este texto es un nombre propio registrado? */
export function esTextoSinTraducir(text) {
  return textosSinTraducir.has(normalizarParaComparar(text));
}
