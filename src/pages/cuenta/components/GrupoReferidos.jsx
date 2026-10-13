import React, { useState } from 'react';
import { Check, Clock, Coins, Receipt, AlertCircle, UserPlus } from 'lucide-react';
import { GlassCard } from '../../../components/ui';
import { IconoWala } from '../../../componentes/kit/IconosWala';
import Moneda from '../../../components/common/Moneda';
import {
  estimateReferralReward,
  VENTANA_REFERIDO_MS,
  VENTANA_INVITACION_MS,
  BONO_BIENVENIDA_INVITACION,
} from '../../../services/referrals';
import DetallePedidoReferido from './DetallePedidoReferido';
import styles from '../CuentaReferidosPage.module.css';

// Filas visibles antes de "Ver todas": un link en un grupo grande puede
// juntar decenas de personas.
const VISIBLES = 5;

const ms = (t) => t?.toMillis?.() || 0;

// "12 h 30 min" / "45 min" / "menos de 1 min". null si ya venció.
export const restanteLegible = (resta) => {
  if (!(resta > 0)) return null;
  const totalMin = Math.floor(resta / 60000);
  const horas = Math.floor(totalMin / 60);
  if (horas >= 48) return `${Math.floor(horas / 24)} días`;
  if (horas > 0) return `${horas} h ${totalMin % 60} min`;
  if (totalMin > 0) return `${totalMin} min`;
  return 'menos de 1 min';
};

const fechaCorta = (t) => {
  const v = ms(t);
  return v ? new Date(v).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '';
};

/**
 * Estado de una persona, en palabras. Cada doc de `referrals` es UNA persona
 * que abrió un link (ver registrarVisitaReferidoSecure).
 */
function estadoDe(r, ahora) {
  const conCompra = ['purchased', 'completed', 'claimed'].includes(r.status);
  if (r.status === 'claimed') return { clave: 'reclamado', conCompra };
  if (r.status === 'ineligible') return { clave: 'no_califico', conCompra: false };
  if (conCompra) return { clave: 'compro', conCompra };
  if (r.status === 'registered') {
    const resta = ms(r.aceptadaAt) + VENTANA_INVITACION_MS - ahora;
    return { clave: resta > 0 ? 'cuenta_nueva' : 'vencido', resta };
  }
  const resta = ms(r.clickedAt) + VENTANA_REFERIDO_MS - ahora;
  return { clave: resta > 0 ? 'entro' : 'vencido', resta };
}

const Persona = ({ r, nombre, ahora, abierto, onToggle, onClaim, reclamando }) => {
  const e = estadoDe(r, ahora);
  const confirmada = e.clave === 'reclamado' || r.status === 'completed';
  const ganancia = confirmada ? (r.earnedCoins || 0) : estimateReferralReward(r.orderTotal, r);
  const restante = restanteLegible(e.resta);
  const puedeReclamar = r.status === 'purchased' || r.status === 'completed';

  let detalle;
  if (e.clave === 'entro') detalle = `Entró el ${fechaCorta(r.clickedAt)} · le quedan ${restante} para comprar`;
  else if (e.clave === 'cuenta_nueva') detalle = `Creó su cuenta y recibió ${BONO_BIENVENIDA_INVITACION} monedas · tiene ${restante} para su primera compra`;
  else if (e.clave === 'vencido') detalle = `Entró el ${fechaCorta(r.clickedAt)} · no compró a tiempo`;
  else if (e.clave === 'no_califico') detalle = 'Esta compra no calificó para el premio';
  else {
    // Lo que compró de verdad: el link puede ser de otro producto (cuenta
    // cualquier compra en 36 h).
    const lista = r.productosComprados || [];
    const que = lista.length ? `Compró ${lista.slice(0, 2).join(', ')}${lista.length > 2 ? ` y ${lista.length - 2} más` : ''}` : 'Compró';
    detalle = `${que} · S/ ${Number(r.orderTotal || 0).toFixed(2)} · ${fechaCorta(r.purchasedAt || r.clickedAt)}`;
  }

  return (
    <li className={styles.persona}>
      <div className={styles.personaFila}>
        <span className={`${styles.personaAvatar} ${r.visitanteNombre ? '' : styles.personaAnonima}`} aria-hidden="true">
          {r.visitanteNombre ? r.visitanteNombre.charAt(0) : '?'}
        </span>
        <div className={styles.personaInfo}>
          <span className={styles.personaNombre}>
            {nombre}
            {e.clave === 'reclamado' && (
              <span className={`${styles.estadoChip} ${styles.chipOk}`}><Check size={12} aria-hidden="true" /> Reclamado</span>
            )}
            {e.clave === 'cuenta_nueva' && (
              <span className={`${styles.estadoChip} ${styles.chipEtapa}`}><UserPlus size={12} aria-hidden="true" /> Cuenta nueva</span>
            )}
            {e.clave === 'entro' && (
              <span className={`${styles.estadoChip} ${styles.chipTiempo}`}><Clock size={12} aria-hidden="true" /> {restante}</span>
            )}
            {e.clave === 'vencido' && (
              <span className={`${styles.estadoChip} ${styles.chipOff}`}>Plazo vencido</span>
            )}
            {e.clave === 'no_califico' && (
              <span className={`${styles.estadoChip} ${styles.chipOff}`}><AlertCircle size={12} aria-hidden="true" /> No calificó</span>
            )}
          </span>
          <span className={styles.personaEstado}>{detalle}</span>
        </div>

        {e.conCompra && (
          <span className={styles.rewardBadge}>
            <span className={styles.rewardLabel}>{confirmada ? 'Ganas' : 'Ganarías'}</span>
            <span className={styles.rewardAmount}><Moneda />+{ganancia}</span>
          </span>
        )}
      </div>

      {(r.orderId || puedeReclamar) && (
        <div className={styles.personaAcciones}>
          {r.orderId && (
            <button type="button" className={styles.btnGhost} onClick={onToggle} aria-expanded={abierto}>
              <Receipt size={15} aria-hidden="true" />
              {abierto ? 'Ocultar pedido' : 'Ver pedido'}
            </button>
          )}
          {puedeReclamar && (
            <button type="button" className={styles.btnSolido} onClick={onClaim} disabled={reclamando}>
              <Coins size={16} aria-hidden="true" />
              {reclamando ? 'Reclamando…' : 'Reclamar monedas'}
            </button>
          )}
        </div>
      )}

      {r.orderId && abierto && <DetallePedidoReferido referralId={r.id} />}
    </li>
  );
};

/**
 * Un link y las personas que entraron por él: "6 entraron · 2 compraron" y la
 * lista (nombre si tiene cuenta; si no, "Visitante 3").
 */
const GrupoReferidos = ({
  titulo, antetitulo, icono, imagen, descripcion, personas, ahora,
  detallesAbiertos, onToggleDetalle, onClaim, claimingId, extra,
}) => {
  const [todas, setTodas] = useState(false);
  const compraron = personas.filter((r) => ['purchased', 'completed', 'claimed'].includes(r.status)).length;
  const cuentas = personas.filter((r) => r.invitadoUid).length;

  // Número de visitante por orden de llegada (el más antiguo es el 1).
  const orden = [...personas].sort((a, b) => ms(a.clickedAt || a.createdAt) - ms(b.clickedAt || b.createdAt));
  const numero = new Map(orden.map((r, i) => [r.id, i + 1]));
  const visibles = todas ? personas : personas.slice(0, VISIBLES);

  return (
    <GlassCard as="section" variant="solid" padding="md" animate={false} className={styles.grupoCard} bodyClassName={styles.grupoBody}>
      <header className={styles.grupoHead}>
        {imagen
          ? <img src={imagen} alt="" className={styles.grupoFoto} loading="lazy" />
          : <IconoWala nombre={icono || 'regalo'} tamano={40} />}
        <div className={styles.grupoTexto}>
          {antetitulo && <p className={styles.grupoAntetitulo}>{antetitulo}</p>}
          <h4 className={styles.grupoTitulo}>{titulo}</h4>
          <p className={styles.grupoMeta}>
            {personas.length} {personas.length === 1 ? 'entró' : 'entraron'}
            {cuentas > 0 && <> · {cuentas} {cuentas === 1 ? 'cuenta nueva' : 'cuentas nuevas'}</>}
            {' · '}{compraron} {compraron === 1 ? 'compró' : 'compraron'}
          </p>
          {descripcion && <p className={styles.grupoDescripcion}>{descripcion}</p>}
        </div>
      </header>

      {personas.length === 0 ? (
        <p className={styles.pieNota}>Todavía nadie entró por este link.</p>
      ) : (
        <ul className={styles.personas}>
          {visibles.map((r) => (
            <Persona
              key={r.id}
              r={r}
              nombre={r.visitanteNombre || `Visitante ${numero.get(r.id)}`}
              ahora={ahora}
              abierto={!!detallesAbiertos[r.id]}
              onToggle={() => onToggleDetalle(r.id)}
              onClaim={() => onClaim(r)}
              reclamando={claimingId === r.id}
            />
          ))}
        </ul>
      )}

      {personas.length > VISIBLES && (
        <button type="button" className={styles.verTodas} onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver menos' : `Ver las ${personas.length} personas`}
        </button>
      )}
      {extra}
    </GlassCard>
  );
};

export default GrupoReferidos;
