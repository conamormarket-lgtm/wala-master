/*
 * Borrar la cuenta: lo que se explica en la página pública /eliminar-cuenta
 * (el enlace que se da a Google Play) y en Mi cuenta › Ajustes › Borrar mi
 * cuenta. Lo que hace de verdad el servidor está en
 * functions/eliminarCuentaLogic.js (BORRAR / CONSERVAR): si cambia allá,
 * cambiar aquí y la fecha.
 */

import { empresa } from '../empresa';

/** Lo que se borra (lista corta para la cuenta y la página pública). */
export const SE_BORRA = [
  'Tu perfil: nombre, correo, teléfono, documento, foto y fechas importantes.',
  'Tus direcciones, tu lista de deseos y tus tarjetas guardadas.',
  'Tus creaciones y los archivos que subiste, tus diseños publicados en la comunidad y tus opiniones.',
  'Tus monedas, cupones, misiones, partidas y premios de los juegos.',
  'Tus referidos, tus participaciones en sorteos y tus avisos.',
  'Los datos de uso de la tienda ligados a tu cuenta y tu acceso (correo, contraseña o Google).',
];

/** Lo que se conserva porque la ley lo exige. */
export const SE_CONSERVA = [
  'Tus pedidos y sus comprobantes y registros de pago, durante el plazo que exigen las normas tributarias y contables del Perú (por lo general, 5 años).',
  'Los reclamos del Libro de Reclamaciones, al menos 2 años (INDECOPI).',
  'Un registro de que la cuenta se borró, con la fecha y sin datos personales.',
];

export const ELIMINAR_CUENTA = {
  titulo: 'Eliminar tu cuenta de Walá',
  actualizado: '9 de noviembre de 2026',
  secciones: [
    {
      id: 'app',
      titulo: 'Desde la app',
      parrafos: [
        'Abre la app de Walá e inicia sesión con tu cuenta.',
        'Entra a Mi cuenta › Ajustes › Borrar mi cuenta.',
        'Revisamos si tienes algo pendiente. Si no, vuelve a entrar con tu contraseña o con Google y confirma el borrado.',
      ],
    },
    {
      id: 'web',
      titulo: 'Desde la web',
      parrafos: [
        'Entra a wala.pe, inicia sesión y ve a Mi cuenta › Ajustes. Al final está "Borrar mi cuenta" (el botón de abajo te lleva directo; si no has iniciado sesión, te lo pide primero).',
        'El borrado es inmediato: al terminar se cierra tu sesión y ya no puedes volver a entrar con esa cuenta.',
      ],
    },
    {
      id: 'pendientes',
      titulo: 'Cuándo no se puede borrar todavía',
      parrafos: ['Para no perder nada que aún está en curso, primero hay que resolver:'],
      lista: [
        { texto: 'Un pedido que todavía no se entrega (y no está anulado).' },
        { texto: 'Un saldo por pagar en alguno de tus pedidos.' },
        { texto: 'Una suscripción activa al sorteo: cancélala primero desde la página del sorteo.' },
        { texto: 'Un pago que se está procesando en ese momento.' },
      ],
    },
    {
      id: 'borra',
      titulo: 'Qué se borra',
      lista: SE_BORRA.map((texto) => ({ texto })),
    },
    {
      id: 'conserva',
      titulo: 'Qué se conserva y por cuánto tiempo',
      parrafos: ['La ley nos obliga a guardar algunos documentos aunque borres tu cuenta. Solo se usan para cumplir esas obligaciones, y los que tienen plazo se eliminan cuando termina:'],
      lista: SE_CONSERVA.map((texto) => ({ texto })),
    },
    {
      id: 'contacto',
      titulo: 'Si no puedes entrar a tu cuenta',
      parrafos: ['Si no puedes iniciar sesión o prefieres que lo hagamos por ti, escríbenos desde el correo de tu cuenta pidiendo que la borremos. Te responderemos para confirmar que la cuenta es tuya antes de borrarla.'],
      contacto: {
        equipo: 'Equipo de Soporte WALÁ',
        // El WhatsApp va en el botón de la tarjeta de ayuda (el número de /admin/whatsapp).
        lineas: [`Correo electrónico: ${empresa.email}`],
      },
    },
  ],
};
