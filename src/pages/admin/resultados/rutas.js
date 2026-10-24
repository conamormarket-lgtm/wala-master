// Pestañas de Resultados y a dónde llevan los avisos de "Cosas por mejorar".
// Mientras una pestaña no existe, su aviso lleva a la pantalla vieja que tiene
// ese dato (se actualiza al construir cada pestaña).

export const BASE_RESULTADOS = '/admin/resultados';

export const PESTANAS = [
  { to: BASE_RESULTADOS, label: 'Resumen', end: true },
  { to: `${BASE_RESULTADOS}/productos`, label: 'Productos' },
  { to: `${BASE_RESULTADOS}/visitantes`, label: 'Visitantes' },
  { to: `${BASE_RESULTADOS}/clientes`, label: 'Clientes' },
];

export const DESTINOS = {
  productos: `${BASE_RESULTADOS}/productos`,
  visitantes: `${BASE_RESULTADOS}/visitantes`,
  clientes: `${BASE_RESULTADOS}/clientes`,
  enlaces: '#enlaces',
};
