import React from 'react';
import { ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import Boton from '../Boton';
import { Texto, useTexto } from '../Traduccion';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { TarjetaAyuda } from '../piezas/TarjetaAyuda';
import { CabezaLegal, IndiceLegal, SeccionLegal } from '../piezas/Legales';
import s from './Legales.module.css';

/*
 * Las páginas legales: la política de privacidad (/politicas-privacidad) y
 * los términos y condiciones (/terminos-y-condiciones). El libro de
 * reclamaciones (/libro-de-reclamaciones, obligatorio en Perú) está en
 * Reclamaciones.jsx.
 */

const ICONOS = { privacidad: <ShieldCheck aria-hidden="true" />, terminos: <FileText aria-hidden="true" /> };

/* ── Privacidad y términos ──────────────────────────────── */

/**
 * Un documento legal: la cabeza con la fecha, el índice (fijo al costado en
 * escritorio, plegado en el celular) y las secciones numeradas. La sección
 * de contacto termina con la tarjeta de ayuda (Kapi, el correo y WhatsApp).
 *  - tipo: 'privacidad' | 'terminos' (el ícono)
 *  - documento: { titulo, actualizado, secciones: [{ id, titulo, parrafos,
 *    lista: [{ etiqueta, texto }], destacado, contacto }] } · contacto:
 *    { equipo, lineas: [texto] } (los datos tal cual; luego la tarjeta de ayuda)
 *  - sinKapi: la tarjeta de ayuda sin Kapi (con sesión ya está el flotante)
 *  - empresa: { email } · urlWhatsApp
 *  - otro: { pregunta, texto, url } el otro documento ("¿Buscabas cómo
 *    tratamos tus datos?")
 *  - estado: 'cargando'
 */
export function PaginaLegal({ tipo = 'privacidad', documento = {}, empresa = {}, urlWhatsApp, otro, estado, sinKapi = false }) {
  const otrosDocumentos = useTexto('Otros documentos');
  if (estado === 'cargando') return <EsqueletoPagina forma="legal" />;
  const secciones = documento.secciones || [];
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.documento} data-componente="PaginaLegal">
        <CabezaLegal icono={ICONOS[tipo]} titulo={documento.titulo} detalle={documento.actualizado && `Última actualización: ${documento.actualizado}`} />
        <div className={s.cuerpo}>
          <aside className={s.lado}>
            <IndiceLegal secciones={secciones} />
          </aside>
          <article className={s.hoja}>
            {secciones.map((sec, k) => (
              <SeccionLegal key={sec.id} numero={k + 1} {...sec}>
                {sec.contacto?.lineas && (
                  <div className={s.contactoDatos}>
                    {sec.contacto.equipo && <p><strong><Texto>{sec.contacto.equipo}</Texto></strong></p>}
                    {sec.contacto.lineas.map((l) => <p key={l}><Texto>{l}</Texto></p>)}
                  </div>
                )}
                {sec.contacto && (
                  <div className={s.contacto}>
                    <TarjetaAyuda
                      titulo="¿Te quedó una duda?"
                      texto={empresa.email ? `Escríbenos a ${empresa.email} o por WhatsApp: te responde el equipo de Walá.` : 'Escríbenos por WhatsApp: te responde el equipo de Walá.'}
                      accion={urlWhatsApp ? { texto: 'Escribir por WhatsApp', url: urlWhatsApp } : undefined}
                      // Con sesión ya está el Kapi flotante: uno solo a la vista.
                      imagen={sinKapi ? null : undefined}
                    />
                  </div>
                )}
              </SeccionLegal>
            ))}
          </article>
        </div>
        {otro?.url && (
          <nav className={s.otro} aria-label={otrosDocumentos}>
            <span><Texto>{otro.pregunta}</Texto></span>
            <Boton to={otro.url} variante="secundario" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>{otro.texto}</Texto></Boton>
          </nav>
        )}
      </div>
    </BloqueSeccion>
  );
}

// El libro de reclamaciones vive en Reclamaciones.jsx: privacidad y términos no bajan su formulario.
