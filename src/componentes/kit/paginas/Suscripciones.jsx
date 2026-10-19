import React from 'react';
import { ArrowRight, ShieldCheck, Check } from 'lucide-react';
import Boton from '../Boton';
import { IconoWala } from '../IconosWala';
import { Trazo, Garabatos } from '../Marca';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { FormaGanar } from '../piezas/Referidos';
import { Texto } from '../Traduccion';
import s from './Suscripciones.module.css';

/* ── Suscripciones (/suscripciones) ─────────────────────── */

const PASOS_SUSCRIPCION = [
  ['reloj', '1. Programa tus fechas', 'Cuéntanos cuándo son los cumpleaños, aniversarios y días especiales de tus seres queridos.'],
  ['corazon', '2. Lo preparamos con cariño', 'Diseñamos y preparamos regalos personalizados según la ocasión y la persona.'],
  ['escudo', '3. Pagas en cuotas', 'El valor de tus regalos del año se divide en pequeñas cuotas mensuales.'],
  ['camion', '4. Llega a tiempo', 'Recibes cada Walá Box justo antes de la fecha especial, lista para sorprender.'],
];

const VENTAJAS = ['Planifica todo tu año hoy mismo', 'Acceso anticipado cuando lleguen los pagos', 'Diseños exclusivos para los primeros suscriptores'];

/**
 * La suscripción de regalos: cómo funciona y la invitación a dejar las fechas
 * (la encuesta). Todavía sin pagos: los dos botones llevan a la encuesta.
 *  - urlEncuesta · pagosPronto (true: la nota de que el pago mensual llega pronto)
 * Los textos pasan por la traducción.
 */
export function PaginaSuscripciones({ urlEncuesta = '/encuesta-suscripcion', pagosPronto = true }) {
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '1.5rem' }}>
        <div className={s.portada} data-componente="PaginaSuscripciones">
          <div className={s.portadaTexto}>
            <p className={s.antetitulo}><Texto>Nuevo en Walá</Texto></p>
            <h1 className={s.titulo}><Texto>Regalos perfectos, todo el año</Texto><Garabatos variante="titulo" className={s.garabatos} /><Trazo className={s.trazo} /></h1>
            <p className={s.bajada}><Texto>Olvídate de buscar regalos a última hora. Programa las fechas importantes de tus seres queridos y recibe cajas personalizadas justo a tiempo, pagando en cómodas cuotas mensuales.</Texto></p>
            <Boton to={urlEncuesta} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Configurar mis fechas</Texto></Boton>
            {pagosPronto && <p className={s.nota}><ShieldCheck aria-hidden="true" /> <Texto>Configura tus fechas hoy. El pago mensual llega muy pronto.</Texto></p>}
          </div>
          <div className={s.caja} aria-hidden="true">
            <span className={s.cajaTapa} />
            <IconoWala nombre="regalo" tamano={104} girar={-6} />
            <strong>Walá Box</strong>
            <small><Texto>Especial para mamá</Texto></small>
          </div>
        </div>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <TituloSeccion titulo="¿Cómo funciona?" subtitulo="Un proceso simple para que siempre quedes bien." alinear="center" subrayado />
        <ul className={s.pasos}>
          {PASOS_SUSCRIPCION.map(([icono, titulo, texto]) => <li key={titulo}><FormaGanar icono={icono} titulo={titulo}><Texto>{texto}</Texto></FormaGanar></li>)}
        </ul>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <div className={s.llamado}>
          <h2 className={s.llamadoTitulo}><Texto>Adelántate a las fechas especiales</Texto></h2>
          <p><Texto>Estamos terminando los pagos para darte las comisiones más bajas y las mejores cuotas.</Texto> <strong><Texto>Pero no tienes que esperar.</Texto></strong></p>
          <ul className={s.lista}>
            {VENTAJAS.map((t) => <li key={t}><Check aria-hidden="true" /><Texto>{t}</Texto></li>)}
          </ul>
          <Boton to={urlEncuesta} tamano="lg" variante="contorno" style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#4c1d95', '--b-borde': 'transparent' }} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Separar mis fechas ahora</Texto></Boton>
        </div>
      </BloqueSeccion>
    </>
  );
}
