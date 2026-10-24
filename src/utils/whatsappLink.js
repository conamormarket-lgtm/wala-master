// Links de WhatsApp (wa.me) hacia el número de un cliente. Mismo criterio que
// RecepcionPedidos: solo dígitos y, si son 9 (celular peruano), se antepone 51.

export function urlWhatsApp(telefono, mensaje) {
  const soloDigitos = String(telefono || '').replace(/\D/g, '');
  if (!soloDigitos) return null;
  const numero = soloDigitos.length === 9 ? `51${soloDigitos}` : soloDigitos;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${numero}${texto}`;
}

// Teléfono de un perfil de portal_clientes_users: el internacional completo si
// existe (clientes del extranjero), si no el peruano.
export function telefonoDePerfil(perfil) {
  return perfil?.phoneIntl?.full || perfil?.phone || null;
}

// ¿El cliente aceptó recibir mensajes de ofertas por WhatsApp? (Mi perfil)
export function aceptoWhatsApp(perfil) {
  return perfil?.marketingConsent?.whatsapp === true;
}

// Mensaje para quien pasó tiempo mirando un producto. Sin emojis: WhatsApp de
// escritorio (Windows) los rompe al abrir un link wa.me y llegan como "�"; las
// negritas con *...* sí funcionan.
export function mensajeProductoVisto(nombre, producto) {
  const primerNombre = String(nombre || '').trim().split(' ')[0];
  const url = `${window.location.origin}/producto/${producto.id}`;
  const precio = producto.salePrice || producto.price;
  return [
    `¡Hola${primerNombre ? ` ${primerNombre}` : ''}!`,
    `Vimos que te gustó *${producto.name}*${precio ? ` (S/ ${precio})` : ''}. ¡Todavía está disponible!`,
    url,
    '¿Te ayudamos con tu pedido?',
  ].join('\n');
}
