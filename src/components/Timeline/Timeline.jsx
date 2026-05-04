import React from 'react';
import { ETAPAS_TIMELINE, estadoToKey, getQueueStage } from '../../utils/constants';
import { Check } from 'lucide-react';
import styles from './Timeline.module.css';

const STAGGER_MS = 60;

const Timeline = ({ fechas, fechaCompra, pedido, onEtapaClick }) => {
  const fechasSeguras = fechas || {};
  const estadoActualKey = pedido?.estadoGeneral ? (getQueueStage(pedido.estadoGeneral) || estadoToKey(pedido.estadoGeneral)) : null;

  const etapas = ETAPAS_TIMELINE.map(etapa => {
    let fecha = null;
    if (etapa.key === 'compra') {
      fecha = fechaCompra;
    } else {
      fecha = fechasSeguras[etapa.key];
    }
    return {
      ...etapa,
      fecha: fecha || null,
      completado: !!fecha,
      esActual: estadoActualKey !== null && etapa.key === estadoActualKey,
    };
  });

  return (
    <div className={`${styles.timeline} ${pedido?.conDeuda ? styles.timelineDeuda : ''}`}>
      {etapas.map((etapa, index) => {
        const isClickeable = typeof onEtapaClick === 'function';
        const itemClasses = [
          styles.item,
          etapa.completado ? styles.completado : '',
          etapa.esActual ? styles.actual : '',
          isClickeable ? styles.clickeable : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={etapa.key}
            className={itemClasses}
            style={{ animationDelay: `${index * STAGGER_MS}ms` }}
            role={isClickeable ? 'button' : undefined}
            tabIndex={isClickeable ? 0 : undefined}
            onClick={isClickeable ? () => onEtapaClick(etapa.key) : undefined}
            onKeyDown={
              isClickeable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEtapaClick(etapa.key);
                    }
                  }
                : undefined
            }
          >
            {/* Nodo Visual */}
            <div className={styles.dot}>
              {etapa.completado && !etapa.esActual && <Check size={16} strokeWidth={4} />}
              {etapa.esActual && <div className={styles.puntito} />}
            </div>

            {/* Metadatos */}
            <div className={styles.contenido}>
              <div className={styles.etapa}>{etapa.nombre}</div>
              {(etapa.completado || etapa.esActual) && etapa.fecha && (
                 <div className={styles.fecha}>{etapa.fecha}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
