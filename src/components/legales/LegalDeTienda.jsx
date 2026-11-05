import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMessage } from '../../services/messages';
import { empresa } from '../../config/empresa';
import { PaginaLegal } from '../../componentes/kit/paginas/Legales';
import { enlaceWhatsApp } from '../../componentes/kit/piezas/Flotantes';

/*
 * Política de privacidad y términos y condiciones con el kit (paso 6,
 * LEGALES.md): PaginaLegal con el documento de config/legales/ (el mismo
 * texto de antes, palabra por palabra) y el contacto de config/empresa; el
 * WhatsApp, el general de /admin/whatsapp (config/empresa de respaldo).
 * Con sesión, la tarjeta de contacto va sin Kapi (ya está el flotante).
 * Lo de antes: pages/PoliticasPrivacidadViejo.jsx y
 * pages/TerminosCondicionesViejo.jsx (interruptor legalesViejo).
 *  - tipo: 'privacidad' | 'terminos' · documento: el de config/legales/
 */
const MENSAJE = '¡Hola Walá! Tengo una consulta sobre sus políticas.';

/** 912881722 o 51912881722 → 51912881722 (lo que pide wa.me). */
const conPrefijo = (crudo) => {
  const n = String(crudo || '').replace(/\D/g, '');
  return n && !n.startsWith('51') && n.length <= 9 ? `51${n}` : n;
};

const OTRO = {
  privacidad: { pregunta: '¿Buscabas las condiciones del servicio?', texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' },
  terminos: { pregunta: '¿Buscabas cómo tratamos tus datos?', texto: 'Política de Privacidad', url: '/politicas-privacidad' },
};

export default function LegalDeTienda({ tipo, documento }) {
  const { userProfile } = useAuth();
  // El WhatsApp general de /admin/whatsapp (el mismo del botón flotante en
  // estas páginas). Antes iba fijo el de config/empresa, que es otro número.
  const { data: numero } = useQuery({
    queryKey: ['whatsapp-general'],
    queryFn: async () => conPrefijo((await getMessage('whatsapp_number')).data),
    staleTime: 10 * 60 * 1000,
  });
  const urlWhatsApp = enlaceWhatsApp(numero || empresa.whatsapp, MENSAJE);
  return (
    <PaginaLegal
      tipo={tipo}
      documento={documento}
      empresa={empresa}
      urlWhatsApp={urlWhatsApp}
      otro={OTRO[tipo]}
      sinKapi={Boolean(userProfile)}
    />
  );
}
