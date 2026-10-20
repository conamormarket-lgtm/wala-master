// Las columnas que se ven si el pie no tiene nada guardado (pages/footer). El
// editor del kit las ofrece como base para empezar a editarlo. Las usan el pie
// del kit (PieDeTienda), el de antes (FooterViejo) y EditorDeTienda.
export const COLUMNAS_POR_DEFECTO = [
  { id: 'c1', title: 'Walá', content: 'Prendas personalizadas con amor y dedicación', type: 'text' },
  { id: 'c2', title: 'Enlaces', type: 'links', links: [
    { text: 'Tienda', url: '/tienda' },
    { text: 'Crear', url: '/personalizar' },
    { text: 'Mi cuenta', url: '/cuenta' },
    { text: 'Contacto WhatsApp', url: 'https://wa.me/51912881722' },
    { text: 'Políticas de Privacidad', url: '/politicas-privacidad' },
    { text: 'Términos y Condiciones', url: '/terminos-y-condiciones' }
  ]}
];
