import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { empresa } from '../../config/empresa';
import { PaginaLegal } from '../../componentes/kit/paginas/Legales';
import { enlaceWhatsApp } from '../../componentes/kit/piezas/Flotantes';

/*
 * Política de privacidad y términos y condiciones con el kit (paso 6,
 * LEGALES.md): PaginaLegal con el documento de config/legales/ (el mismo
 * texto de antes, palabra por palabra) y el contacto de config/empresa.
 * Con sesión, la tarjeta de contacto va sin Kapi (ya está el flotante).
 * Lo de antes: pages/PoliticasPrivacidadViejo.jsx y
 * pages/TerminosCondicionesViejo.jsx (interruptor legalesViejo).
 *  - tipo: 'privacidad' | 'terminos' · documento: el de config/legales/
 */
const URL_WHATSAPP = enlaceWhatsApp(empresa.whatsapp, '¡Hola Walá! Tengo una consulta sobre sus políticas.');

const OTRO = {
  privacidad: { pregunta: '¿Buscabas las condiciones del servicio?', texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' },
  terminos: { pregunta: '¿Buscabas cómo tratamos tus datos?', texto: 'Política de Privacidad', url: '/politicas-privacidad' },
};

export default function LegalDeTienda({ tipo, documento }) {
  const { userProfile } = useAuth();
  return (
    <PaginaLegal
      tipo={tipo}
      documento={documento}
      empresa={empresa}
      urlWhatsApp={URL_WHATSAPP}
      otro={OTRO[tipo]}
      sinKapi={Boolean(userProfile)}
    />
  );
}
