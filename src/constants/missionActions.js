// ── Acciones verificables de Misiones Diarias ───────────────────────────────
// Única fuente de verdad para los `actionKey` que puede llevar una misión.
// La usan tanto el admin (opciones del selector "Verificación" en
// AdminMisiones.jsx) como el cliente (a qué página mandar al usuario cuando
// todavía no hizo la acción, en MisionesPage.jsx). Los valores (las claves de
// este objeto) deben coincidir exactamente con los que dispara cada página
// real vía recordMissionAction (ver src/services/loyalty.js):
//   - CatalogReward.jsx      -> 'visit_catalogo_recompensas'
//   - MisCuponesPage.jsx     -> 'visit_mis_cupones'
//   - MinijuegosPage.jsx     -> 'visit_minijuegos'
//   - WishlistContext.jsx    -> 'add_wishlist' (al agregar un favorito)
export const MISSION_ACTIONS = {
  visit_catalogo_recompensas: {
    adminLabel: 'Visitó el Catálogo de Recompensas',
    goLabel: 'Ir al Catálogo de Recompensas',
    path: '/cuenta/catalogo',
  },
  visit_mis_cupones: {
    adminLabel: 'Visitó Mis Cupones',
    goLabel: 'Ir a Mis Cupones',
    path: '/cuenta/cupones',
  },
  visit_minijuegos: {
    adminLabel: 'Visitó Minijuegos',
    goLabel: 'Ir a Minijuegos',
    path: '/minijuegos',
  },
  add_wishlist: {
    adminLabel: 'Agregó algo a su Lista de Deseos',
    goLabel: 'Ir a mi Lista de Deseos',
    path: '/cuenta/wishlist',
  },
};
