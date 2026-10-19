import React from 'react';
import { PaginaLegal, PaginaReclamaciones, enlaceWhatsApp } from './kit';
import { empresa } from '../config/empresa';
import { limaTodayStr } from '../utils/fechaLima';
import { PRIVACIDAD } from '../config/legales/privacidad';
import { TERMINOS } from '../config/legales/terminos';

/*
 * Legales en la Tienda de prueba: el libro de reclamaciones
 * (/libro-de-reclamaciones), la política de privacidad (/politicas-privacidad)
 * y los términos y condiciones (/terminos-y-condiciones).
 * Los textos son los reales (config/legales/, los mismos de la tienda) y
 * la empresa sale de config/empresa. Enviar una reclamación aquí no
 * guarda nada: arma el código como la tienda (WALA-AAAAMMDD-NNNN).
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const enPalabras = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

export const VISTAS_LEGALES = [
  ['Libro de reclamaciones', '/libro-de-reclamaciones'],
  ['Política de privacidad', '/politicas-privacidad'],
  ['Términos y condiciones', '/terminos-y-condiciones'],
];

export const ESTADOS_LEGALES = [
  ['falla', 'El envío falla'],
  ['cargando', 'Cargando'],
];

const URL_WHATSAPP = enlaceWhatsApp(empresa.whatsapp, '¡Hola Walá! Tengo una consulta sobre sus políticas.');

export function LegalesDemo({ ruta = VISTAS_LEGALES[0][1], sesion = false, usuario, estados = [] }) {
  const cargando = estados.includes('cargando') ? 'cargando' : undefined;
  if (ruta === '/politicas-privacidad' || ruta === '/terminos-y-condiciones') {
    const privacidad = ruta === '/politicas-privacidad';
    return (
      <PaginaLegal
        key={ruta}
        estado={cargando}
        tipo={privacidad ? 'privacidad' : 'terminos'}
        documento={privacidad ? PRIVACIDAD : TERMINOS}
        empresa={empresa}
        urlWhatsApp={URL_WHATSAPP}
        otro={privacidad
          ? { pregunta: '¿Buscabas las condiciones del servicio?', texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' }
          : { pregunta: '¿Buscabas cómo tratamos tus datos?', texto: 'Política de Privacidad', url: '/politicas-privacidad' }}
      />
    );
  }
  const hoy = limaTodayStr();
  return (
    <PaginaReclamaciones
      key={`${sesion}-${estados.join()}`}
      estado={cargando}
      empresa={empresa}
      hoy={enPalabras(hoy)}
      // Con sesión, los datos de la cuenta ya puestos (ejemplo: el usuario de la demo).
      inicial={sesion && usuario ? { nombre: usuario.nombre, email: usuario.email, tipoDocumento: 'DNI', documento: '45879632', telefono: '987654321' } : {}}
      urlTienda="/"
      onEnviar={async () => {
        await espera(1100); // lo que tarda guardar en libro_reclamaciones
        if (estados.includes('falla')) throw new Error('Revisa tu conexión e inténtalo otra vez. Si sigue fallando, escríbenos por WhatsApp.');
        const codigo = `WALA-${hoy.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        return { codigo, fecha: enPalabras(hoy) };
      }}
    />
  );
}
