import React from 'react';
import { ArrowRight, Check, Lock, LogIn, Sparkles } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta, GananciaMonedas } from '../Etiquetas';
import { Aviso } from '../Feedback';
import CuentaRegresiva from '../CuentaRegresiva';
import { IconoWala } from '../IconosWala';
import { BarraProgreso } from './BarraProgreso';
import s from './TarjetaJuego.module.css';

/* Botón según lo que se puede hacer: el violeta lleno es siempre "jugar". */
const ACCIONES = {
  jugar: { variante: 'primario', iconoFin: <ArrowRight aria-hidden="true" /> },
  hecho: { variante: 'secundario', icono: <Check aria-hidden="true" /> },
  bloqueado: { variante: 'secundario', icono: <Lock aria-hidden="true" />, disabled: true },
  login: { variante: 'contorno', icono: <LogIn aria-hidden="true" /> },
  cargando: { variante: 'secundario', cargando: true },
};

const ICONOS_NOTA = { bloqueo: <Lock aria-hidden="true" />, hecho: <Check aria-hidden="true" />, buena: <Sparkles aria-hidden="true" /> };

/**
 * Tarjeta de un minijuego (Zona Arcade). Recibe datos, no nodos: así la página
 * le pasa lo que ya calcula (juegosDelArcade arma todo desde el perfil).
 *
 *  - imagen: banner ilustrado; llena su marco (en blanco y negro si `bloqueada`)
 *  - titulo, descripcion
 *  - estado: { texto, tono, punto } → Etiqueta sobre el banner
 *  - recompensa: { texto, icono? } → GananciaMonedas (icono: nombre de
 *    IconoWala en vez de la moneda, p. ej. 'regalo')
 *  - racha: { dias, de = 7, texto = 'Días reclamados' } → BarraProgreso por pasos
 *  - nota: { texto, tipo: 'bloqueo' | 'hecho' | 'buena' } → Aviso compacto
 *  - accion: { texto, tipo: 'jugar' | 'hecho' | 'bloqueado' | 'login' |
 *    'cargando', url | onClick }
 *  - espera: texto fijo ("Te faltan 3 días de racha") o { hasta: ISO, texto }
 *    → CuentaRegresiva en frase ("Disponible de nuevo en 7 h 56 min")
 *  - atenuada: ya jugada hoy; bloqueada: todavía no es tuya
 */
export function TarjetaJuego({ imagen, titulo, descripcion, estado, recompensa, racha, nota, accion, espera, atenuada = false, bloqueada = false }) {
  const boton = accion ? ACCIONES[accion.tipo] || ACCIONES.jugar : null;
  return (
    <article className={[s.juego, atenuada && s.atenuada, bloqueada && s.bloqueada].filter(Boolean).join(' ')}>
      <div className={s.banner}>
        <div className={s.bannerRecorte}>
          {imagen && <img src={imagen} alt="" loading="lazy" decoding="async" draggable={false} />}
        </div>
        {estado?.texto && (
          <span className={s.estado}>
            <Etiqueta tono={estado.tono || 'violeta'} punto={estado.punto} sobreFoto>{estado.texto}</Etiqueta>
          </span>
        )}
      </div>

      <div className={s.cuerpo}>
        <h2 className={s.titulo}>{titulo}</h2>
        {descripcion && <p className={s.descripcion}>{descripcion}</p>}

        {recompensa?.texto && (
          <span className={s.recompensa}>
            <GananciaMonedas icono={recompensa.icono ? <IconoWala nombre={recompensa.icono} tamano={18} /> : undefined}>{recompensa.texto}</GananciaMonedas>
          </span>
        )}

        {racha && (
          <BarraProgreso
            pasos
            valor={racha.dias}
            max={racha.de || 7}
            texto={<><span>{racha.texto || 'Días reclamados'}</span><strong>{racha.dias}/{racha.de || 7}</strong></>}
          />
        )}

        {nota?.texto && (
          <Aviso compacto tipo={nota.tipo === 'bloqueo' ? 'info' : 'exito'} icono={ICONOS_NOTA[nota.tipo] || ICONOS_NOTA.bloqueo}>{nota.texto}</Aviso>
        )}

        {accion && (
          <div className={s.accion}>
            <Boton bloque to={boton.disabled ? undefined : accion.url} onClick={accion.onClick} {...boton}>{accion.texto}</Boton>
          </div>
        )}

        {espera && (
          <p className={s.espera}>
            {typeof espera === 'string' ? espera : <CuentaRegresiva variante="frase" hasta={espera.hasta} etiqueta={espera.texto || 'Disponible de nuevo en'} textoFin="¡Ya está disponible!" />}
          </p>
        )}
      </div>
    </article>
  );
}
