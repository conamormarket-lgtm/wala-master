/**
 * ¿La llamada viene de la app de Walá? (sorteos: "obligatorio" y "chanceExtra").
 *
 * - La app de antes (Capacitor) corre en https://localhost (Android) o
 *   capacitor://localhost (iOS) y su navegador manda ese Origin.
 * - La app de ahora (Expo / React Native) llama a las funciones desde el SDK
 *   nativo de Firebase: la petición no lleva Origin.
 *
 * Un navegador no puede ni falsear el Origin ni quitarlo en una llamada a otro
 * dominio (wala.pe → cloudfunctions.net), así que desde la web no se pasa por
 * app aunque mande origenApp: true. Sin App Check no resiste una llamada armada
 * fuera del navegador: es lo mismo que antes, solo que ahora también reconoce la
 * app nueva.
 */
const ORIGENES_APP = new Set(["https://localhost", "capacitor://localhost"]);

function vieneDeLaApp(data, context) {
  if (!data || data.origenApp !== true) return false;
  const cabeceras = (context && context.rawRequest && context.rawRequest.headers) || {};
  const origen = String(cabeceras.origin || "").trim().toLowerCase();
  return origen === "" || ORIGENES_APP.has(origen);
}

module.exports = { vieneDeLaApp, ORIGENES_APP };
