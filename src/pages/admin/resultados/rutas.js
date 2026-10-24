// Pestañas de Resultados y a dónde llevan los avisos de "Cosas por mejorar".
// soloClientes: muestra datos personales; solo con permiso de clientes
// (manage_clients), igual que en el menú.

export const BASE_RESULTADOS = '/admin/resultados';

export const PESTANAS = [
  { to: BASE_RESULTADOS, label: 'Resumen', end: true },
  { to: `${BASE_RESULTADOS}/productos`, label: 'Productos' },
  { to: `${BASE_RESULTADOS}/visitantes`, label: 'Visitantes' },
  { to: `${BASE_RESULTADOS}/clientes`, label: 'Clientes', soloClientes: true },
  { to: `${BASE_RESULTADOS}/opiniones`, label: 'Opiniones', soloClientes: true },
  { to: `${BASE_RESULTADOS}/tecnico`, label: 'Detalle técnico' },
];

export const DESTINOS = {
  productos: `${BASE_RESULTADOS}/productos`,
  visitantes: `${BASE_RESULTADOS}/visitantes`,
  clientes: `${BASE_RESULTADOS}/clientes`,
  enlaces: '#enlaces',
};
