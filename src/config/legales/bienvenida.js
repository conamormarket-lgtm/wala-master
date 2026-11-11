/*
 * Las condiciones de la promo "Tu primera compra puede salir gratis" (semana
 * de bienvenida), en el formato de PaginaLegal (ver terminos.js). Los montos
 * salen de la config de la promo (loyaltyConfig/primeraCompra) cuando se
 * conocen; si no, los del lanzamiento. Un cambio de reglas se hace aquí (y en
 * functions/primeraCompraLogic.js) y cambia la fecha.
 */

const s = (n) => `S/ ${Number(n).toFixed(2).replace(/\.00$/, '')}`;

export function documentoBienvenida({ premio = 10, minimo = 50, horas = 168 } = {}) {
  const dias = Math.round(horas / 24);
  return {
    titulo: 'Tu primera compra puede salir gratis',
    actualizado: '11 de noviembre de 2026',
    secciones: [
      {
        id: 'que-es',
        titulo: 'Qué es',
        parrafos: [
          `Cada cuenta nueva de Walá tiene una semana de bienvenida: ${dias} días (${horas} horas) desde que se crea. En ese tiempo, por cada amigo nuevo que se registre con tu invitación y haga su primera compra, ganas ${s(premio)} de saldo de bienvenida para tu propia primera compra.`,
        ],
      },
      {
        id: 'quien',
        titulo: 'Quién participa',
        lista: [
          { texto: 'Las cuentas creadas desde el inicio de la promoción. Las cuentas que ya existían no participan.' },
          { texto: 'No participan quienes ya compraron antes en Walá (en la web, en la app, por WhatsApp o en un live). Lo revisamos con tu cuenta, tu documento y tu teléfono.' },
          { texto: 'El plazo empieza al crear tu cuenta y no se alarga por compartir, ganar saldo ni por ningún otro motivo.' },
        ],
      },
      {
        id: 'como-ganas',
        titulo: 'Cómo ganas saldo',
        parrafos: [`Ganas ${s(premio)} por cada amigo que cumpla todo esto:`],
        lista: [
          { texto: 'Crea una cuenta nueva con tu invitación y confirma su documento y su teléfono.' },
          { texto: `Paga al menos ${s(minimo)} en productos con dinero (el envío, las monedas, los cupones y su propio saldo no cuentan).` },
          { texto: 'Su compra se hace mientras dura tu semana de bienvenida. Si su pago se confirma después (por ejemplo, por WhatsApp), ese premio ya no suma.' },
          { texto: 'Algunos productos dejan poco margen y necesitan una compra más grande para dar el premio. Antes de pagar, tu amigo ve si su compra te da el premio o cuánto le falta.' },
        ],
        destacado: 'Cada amigo da un solo premio. Si cancela o devuelve su pedido, pierdes ese premio. El saldo no es dinero en efectivo: no se retira, no se transfiere y no se convierte en monedas.',
      },
      {
        id: 'como-usas',
        titulo: 'Cómo usas tu saldo',
        lista: [
          { texto: 'Solo en tu primera compra y antes de que termine tu semana de bienvenida.' },
          { texto: 'Paga los productos, hasta su precio completo. El envío se paga aparte, con la regla de siempre.' },
          { texto: 'En algunas marcas solo se puede pagar con saldo una parte del precio; el checkout te dice cuánto.' },
          { texto: 'Un pedido no queda en S/ 0: si tu saldo cubre todo y el envío es gratis, pagas S/ 1.' },
          { texto: 'Lo que no uses en tu primera compra vence en ese momento y no vuelve. Si termina tu plazo sin comprar, todo tu saldo vence.' },
        ],
      },
      {
        id: 'monedas-cupones',
        titulo: 'Tus monedas y cupones',
        parrafos: [
          'Durante tu semana de bienvenida sigues ganando monedas (por ejemplo, en los minijuegos) y cupones, pero quedan en pausa: no se pueden usar, canjear ni juntar con el saldo. Se liberan cuando haces tu primera compra o cuando termina tu plazo.',
          'Las monedas en pausa no se borran en el reinicio de fin de mes, y tienes al menos 7 días para usarlas después de que se liberen.',
          'Mientras estás en tu semana de bienvenida, las compras de tus invitados te dan saldo y no monedas. Después vuelven las monedas por invitar de siempre.',
        ],
      },
      {
        id: 'cancelaciones',
        titulo: 'Cancelaciones y casos especiales',
        lista: [
          { texto: 'Si cancelas tu primera compra, tu plazo no vuelve a empezar y el saldo usado no se devuelve. Si el problema fue nuestro, lo resolvemos contigo.' },
          { texto: 'Un pedido pagado con saldo de bienvenida no le da premio a quien te invitó.' },
          { texto: 'Podemos anular premios que vengan de cuentas falsas, repetidas o de la misma persona, y revisar cualquier caso con atención al cliente.' },
          { texto: 'Walá puede terminar o cambiar esta promoción. Los cambios no afectan el saldo que ya ganaste dentro de tu plazo.' },
        ],
      },
    ],
  };
}
