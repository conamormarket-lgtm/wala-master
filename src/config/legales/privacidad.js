/*
 * Los textos legales de la tienda como datos (PaginaLegal): los lee la página
 * y la demo de componentes. Copiados tal cual de las páginas de antes
 * (2026-10-15). Cada sección es { id, titulo, parrafos, lista: [{ etiqueta,
 * texto }], destacado, contacto }; el número lo pone la página y el contacto
 * sale de config/empresa. Un cambio legal se hace aquí y cambia la fecha.
 */

import { empresa } from '../empresa';

export const PRIVACIDAD = {
  titulo: 'Política de Privacidad',
  actualizado: '8 de septiembre de 2026',
  secciones: [
    {
      id: 'introduccion',
      titulo: 'Introducción',
      parrafos: [
        'En WALÁ ("nosotros", "nuestro", "la Aplicación"), respetamos profundamente su privacidad y nos comprometemos a proteger sus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, compartimos y protegemos su información cuando utiliza nuestra aplicación móvil (Android/iOS) y nuestro entorno web.',
        'Al descargar, acceder o utilizar nuestra Plataforma, usted acepta las prácticas descritas en esta política. Si no está de acuerdo con ellas, por favor no utilice nuestros servicios.',
      ],
    },
    {
      id: 'informacion',
      titulo: 'Información que Recopilamos',
      parrafos: ['Para brindar un servicio de comercio electrónico y personalización de productos funcional, recopilamos los siguientes tipos de información:'],
      lista: [
        { etiqueta: 'Datos de Identificación y Contacto', texto: 'Nombre, apellidos, dirección de correo electrónico y número de teléfono proporcionados durante el registro (vía formulario o proveedores de autenticación como Google/Google Play).' },
        { etiqueta: 'Datos de Facturación y Envío', texto: 'Direcciones de entrega y datos fiscales necesarios para el procesamiento de sus pedidos.' },
        { etiqueta: 'Datos de Contenido y Personalización', texto: 'Imágenes subidas, diseños personalizados y configuraciones elegidas en nuestro editor para crear sus pedidos especiales.' },
        { etiqueta: 'Datos del Dispositivo y Uso (Permisos)', texto: 'Audio/Micrófono: Si elige utilizar la función de búsqueda por voz dentro de la aplicación, requeriremos acceso temporal a su micrófono. El audio no se graba ni se almacena de forma permanente, solo se utiliza en tiempo real para procesar su búsqueda.' },
      ],
    },
    {
      id: 'uso',
      titulo: 'Uso de la Información',
      parrafos: ['Utilizamos su información personal estrictamente para los siguientes propósitos:'],
      lista: [
        { texto: 'Gestionar su cuenta, procesar sus compras, pagos y entregar sus productos personalizados.' },
        { texto: 'Brindar soporte técnico y atención al cliente.' },
        { texto: 'Gestionar el acceso a nuestro sistema de recompensas ("Monedas") y sistema de Referidos ("Mis Referidos").' },
        { texto: 'Enviar notificaciones transaccionales sobre el estado de su pedido o avisos importantes de la aplicación.' },
        { texto: 'Garantizar la seguridad de la plataforma y prevenir actividades fraudulentas.' },
      ],
    },
    {
      id: 'comparticion',
      titulo: 'Compartición de la Información',
      parrafos: ['No vendemos, alquilamos ni comercializamos sus datos personales. Solo compartimos información con terceros de confianza que son estrictamente esenciales para el funcionamiento del servicio:'],
      lista: [
        { etiqueta: 'Proveedores de Servicios Cloud', texto: 'Utilizamos Google Cloud y Firebase (Google) para alojar nuestra base de datos, imágenes de manera segura y gestionar la autenticación.' },
        { etiqueta: 'Pasarelas de Pago', texto: 'Proveedores financieros autorizados encargados de procesar pagos de forma encriptada. (WALÁ no almacena números de tarjetas de crédito).' },
        { etiqueta: 'Logística', texto: 'Empresas de transporte para poder entregar su producto físico en la dirección indicada.' },
      ],
    },
    {
      id: 'retencion',
      titulo: 'Retención y Eliminación de Datos',
      parrafos: [
        'Usted tiene el derecho absoluto de acceder, rectificar o eliminar sus datos personales en cualquier momento.',
        'Si desea eliminar su cuenta y borrar por completo su historial de pedidos, diseños guardados y monedas acumuladas, puede solicitarlo enviándonos un correo a nuestro equipo de soporte. Todo dato personal será eliminado de nuestros servidores, exceptuando aquellos documentos financieros que la ley nos obligue a conservar por periodos fiscales determinados.',
      ],
    },
    {
      id: 'menores',
      titulo: 'Privacidad de Menores',
      parrafos: ['Nuestra aplicación y servicio no están dirigidos a niños menores de 13 años. No recopilamos conscientemente información personal de menores. Si descubrimos que un menor nos ha proporcionado información personal, procederemos a eliminarla inmediatamente de nuestros servidores.'],
    },
    {
      id: 'cambios',
      titulo: 'Cambios en la Política de Privacidad',
      parrafos: ['Nos reservamos el derecho de actualizar esta política en cualquier momento para reflejar cambios en nuestras prácticas o exigencias legales. Le notificaremos sobre cambios significativos a través de un aviso destacado en nuestra aplicación o web antes de que el cambio entre en vigencia.'],
    },
    {
      id: 'contacto',
      titulo: 'Contacto',
      parrafos: ['Si tiene alguna pregunta, inquietud o solicitud relacionada con esta Política de Privacidad o sus datos, no dude en contactarnos:'],
      // Los datos de contacto tal cual estaban (el correo, de config/empresa).
      contacto: {
        equipo: 'Equipo de Soporte WALÁ',
        lineas: [
          `Correo electrónico: ${empresa.email}`,
        'Atención continua a través de nuestra App / Portal Web (Sección WhatsApp).',
        ],
      },
    },
  ],
};
