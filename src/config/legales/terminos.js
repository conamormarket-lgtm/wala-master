/*
 * Los textos legales de la tienda como datos (PaginaLegal): los lee la página
 * y la demo de componentes. Copiados tal cual de las páginas de antes
 * (2026-10-15). Cada sección es { id, titulo, parrafos, lista: [{ etiqueta,
 * texto }], destacado, contacto }; el número lo pone la página y el contacto
 * sale de config/empresa. Un cambio legal se hace aquí y cambia la fecha.
 */

import { empresa } from '../empresa';

export const TERMINOS = {
  titulo: 'Términos y Condiciones',
  actualizado: '7 de septiembre de 2026',
  secciones: [
    {
      id: 'introduccion',
      titulo: 'Introducción',
      parrafos: ['Bienvenido a WALÁ. Al acceder o utilizar nuestra aplicación y sitio web, aceptas cumplir y estar sujeto a los siguientes Términos y Condiciones. Te rogamos que los leas detenidamente antes de utilizar nuestro servicio. Si no estás de acuerdo con estos términos, no debes usar la aplicación.'],
    },
    {
      id: 'uso',
      titulo: 'Uso de la Aplicación',
      parrafos: ['Nuestra plataforma te permite personalizar, visualizar y adquirir productos físicos (Print on Demand). Al utilizar nuestros servicios, te comprometes a:'],
      lista: [
        { texto: 'Proporcionar información verdadera, precisa y actualizada al registrarte y realizar compras.' },
        { texto: 'No subir, crear ni compartir contenido que sea ilegal, ofensivo, difamatorio, que infrinja derechos de autor de terceros o que sea inapropiado. Nos reservamos el derecho de rechazar diseños que incumplan esta norma.' },
        { texto: 'No utilizar la plataforma para fines ilícitos o no autorizados.' },
      ],
    },
    {
      id: 'compras',
      titulo: 'Compras y Pagos',
      parrafos: ['Al realizar un pedido, te comprometes a pagar el precio total especificado, incluyendo impuestos y gastos de envío aplicables.'],
      lista: [
        { texto: 'Todos los pagos se procesan a través de pasarelas seguras.' },
        { texto: 'Una vez que el pedido ha pasado a producción (al ser productos personalizados), no se podrán realizar cancelaciones ni modificaciones.' },
      ],
    },
    {
      id: 'envios',
      titulo: 'Envíos y Entregas',
      parrafos: ['Nos esforzamos por cumplir con los plazos de entrega estimados mostrados al momento de la compra. Sin embargo, factores externos (como servicios de mensajería) pueden causar demoras ocasionales. WALÁ no se hace responsable por retrasos imputables a las agencias de transporte o causas de fuerza mayor.'],
    },
    {
      id: 'devoluciones',
      titulo: 'Devoluciones y Reembolsos',
      parrafos: ['Dado que nuestros productos son creados de manera 100% personalizada según tus especificaciones, no aceptamos devoluciones ni ofrecemos reembolsos por cambios de opinión o errores en la selección de talla/color por parte del cliente.'],
      // La excepción se destaca: es lo que el cliente necesita encontrar.
      destacado: 'Excepciones: Si el producto llega defectuoso, dañado o el estampado es claramente diferente al diseño final aprobado, te pedimos contactarnos en un plazo máximo de 7 días tras recibirlo para gestionar un reemplazo o reembolso.',
    },
    {
      id: 'propiedad',
      titulo: 'Propiedad Intelectual',
      parrafos: ['Al subir una imagen o diseño a nuestra plataforma, declaras poseer los derechos legales sobre la misma. Nos otorgas una licencia temporal exclusiva para imprimir dicho diseño en tus productos. Todo el contenido nativo de la aplicación (textos, gráficos, logotipos, mockups, etc.) es propiedad exclusiva de WALÁ.'],
    },
    {
      id: 'modificaciones',
      titulo: 'Modificaciones',
      parrafos: ['Nos reservamos el derecho de modificar o reemplazar estos Términos y Condiciones en cualquier momento. El uso continuado de la aplicación tras cualquier cambio constituye la aceptación de los nuevos términos.'],
    },
    {
      id: 'contacto',
      titulo: 'Contacto',
      parrafos: ['Para cualquier duda respecto a estos Términos y Condiciones, puedes contactarnos en:'],
      // Los datos de contacto tal cual estaban (el correo, de config/empresa).
      contacto: {
        equipo: 'Equipo WALÁ',
        lineas: [
          `Correo electrónico: ${empresa.email}`,
        ],
      },
    },
  ],
};
