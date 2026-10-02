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
