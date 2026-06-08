/**
 * Datos legales/identidad del comercio.
 * Fuente única para Libro de Reclamaciones, páginas legales, footer y contacto.
 *
 * ⚠️ IMPORTANTE: reemplaza los valores marcados como "RELLENAR" con los datos
 * reales de la empresa antes de salir a producción. El Libro de Reclamaciones
 * de INDECOPI exige razón social, RUC y domicilio fiscal correctos.
 */

export const empresa = {
  // Identidad legal (obligatorio para INDECOPI / Libro de Reclamaciones)
  razonSocial: 'CATAS GROUP S.A.C.',
  nombreComercial: 'Walá',
  ruc: '20610430857',
  domicilioFiscal: 'Av. Universitaria Nro. 6483, Urb. Santa Luzmila, Comas, Lima',

  // Contacto público
  email: 'amorwala0@gmail.com',
  telefono: '+51 912 881 722',
  whatsapp: '51912881722', // sin "+", formato para wa.me

  // Plazo legal de respuesta del Libro de Reclamaciones (días hábiles)
  plazoRespuestaDiasHabiles: 15,
};

export default empresa;
