/*
 * Los minijuegos por dentro: la Palabra del día (/palabra-del-dia), la
 * Ruleta Semanal (/ruleta) y Las Bolitas de Kapi (/ball-sort). Cada uno en
 * MarcoJuego, con "Cómo se juega" (se abre solo la primera vez) y la hoja del
 * resultado. El premio lo decide el servidor: la página solo dice cómo va.
 *
 * Cada juego vive en su archivo (Palabra.jsx, Ruleta.jsx, Bolitas.jsx): en la
 * tienda cada página baja solo el suyo. Aquí quedan juntos para la demo.
 */
export { PaginaPalabra } from './Palabra';
export { PaginaRuleta } from './Ruleta';
export { PaginaBolitas } from './Bolitas';
