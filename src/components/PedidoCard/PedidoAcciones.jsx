import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import Modal from '../common/Modal';
import HistorialPagos from './HistorialPagos';
import PaypalCheckout from '../PaypalCheckout';
import CulqiCustomCheckout from '../CulqiCustomCheckout';
import { getMessage } from '../../services/messages';
import { estadoToKey } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { showFlyingCoins } from '../../utils/animations';
import { listFilesInFolder } from '../../services/firebase/storage';
import { T } from '../../i18n/useTranslatedText';
import styles from './PedidoAcciones.module.css';

const DEUDA_IMPRESION_MENSAJE = 'STOP... TIENES UNA DEUDA PENDIENTE, POR FAVOR REALIZA TU PAGO PARA QUE TU PEDIDO PUEDA CONTINUAR AVANZANDO';

/**
 * Acciones reales de un pedido (pagar deuda, reclamar monedas, ver boleta,
 * fotos de envío) que antes vivían -junto con un panel de datos crudos del
 * ERP ya redundante con esta página- dentro de la tarjeta expandible de
 * "Mis Pedidos" (PedidoCard.jsx). "Mis Pedidos" y "Rastreo del Pedido" se
 * unificaron en una sola lista (ver App.jsx) que enlaza aquí, así que estas
 * acciones se mudan a CuentaCompraDetallePage -el único lugar de "Mi cuenta"
 * con el detalle completo de un pedido- para no perderlas.
 *
 * A propósito NO se trae: el panel "Datos del cliente/envío/agencia" (ya
 * los muestra esta página con Dirección de entrega + Detalle de la compra),
 * la galería de diseños ni la línea de tiempo de 8 pasos (ya la muestra
 * "Seguimiento" arriba). Tampoco se copia el toggle de expandir: acá no hay
 * nada que ocultar, así que se evita el salto de layout que tenía la
 * tarjeta vieja al abrirse (ver PedidoCard.jsx toggleExpanded). Las boletas
 * de envío, antes precargadas solas al expandir -esa carga async era la
 * causa del "doble salto"-, ahora se piden recién al tocar el botón, igual
 * que "Ver Boleta".
 *
 * @param {object} props
 * @param {object} props.pedido  Pedido CRUDO del ERP (mismos campos que lee
 *   PedidoCard: conDeuda, montoDeuda, montoTotal, montoAdelantado, id,
 *   estadoGeneral, historialPagos, reparto).
 */
const PedidoAcciones = ({ pedido }) => {
  const { userProfile, claimMonedas } = useAuth();

  const [showDeudaImpresionModal, setShowDeudaImpresionModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showBoletaModal, setShowBoletaModal] = useState(false);
  const [boletas, setBoletas] = useState([]);
  const [loadingBoletas, setLoadingBoletas] = useState(false);
  const [boletaError, setBoletaError] = useState(null);
  const [claimingCoins, setClaimingCoins] = useState(false);
  const [coinClaimedLocal, setCoinClaimedLocal] = useState(false);
  const [showBoletasEnvioModal, setShowBoletasEnvioModal] = useState(false);
  const [boletasEnvio, setBoletasEnvio] = useState(null);
  const [loadingBoletasEnvio, setLoadingBoletasEnvio] = useState(false);

  const completedEstados = ['finalizado', 'entregado', 'completado'];
  const estadoPedidoKey = estadoToKey(pedido.estadoGeneral);
  const isCompleted = completedEstados.includes(estadoPedidoKey);

  const pedidoIdMonedas = String(pedido.id ?? '').trim();

  const reclamadas = Array.isArray(userProfile?.monedasReclamadas)
    ? userProfile.monedasReclamadas.map((id) => String(id ?? '').trim())
    : [];

  const yaReclamoMonedas = reclamadas.includes(pedidoIdMonedas) || coinClaimedLocal;
  const canClaimCoins = isCompleted && !yaReclamoMonedas;

  // Mismo aviso que antes abría solo al expandir la tarjeta (toggleExpanded
  // en PedidoCard.jsx): acá el equivalente es "al entrar al detalle".
  useEffect(() => {
    if (estadoPedidoKey === 'impresion' && pedido.conDeuda) {
      setShowDeudaImpresionModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id]);

  const handleClaimCoins = async (e) => {
    e.preventDefault();

    if (claimingCoins || !canClaimCoins) return;

    setClaimingCoins(true);

    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;

      const res = await claimMonedas(pedidoIdMonedas, 10);

      if (!res?.error) {
        setCoinClaimedLocal(true);
        showFlyingCoins(x, y);
      } else {
        console.error('Error al reclamar monedas:', res.error);
      }
    } catch (err) {
      console.error('Error inesperado al reclamar monedas:', err);
    } finally {
      setClaimingCoins(false);
    }
  };

  const { data: configPagos } = useQuery({
    queryKey: ['user-pagos-config'],
    queryFn: async () => {
      const [yapeNum, yapeName, plinNum, plinName, waPagos, waFallback, waText] = await Promise.all([
        getMessage('yape_number'),
        getMessage('yape_name'),
        getMessage('plin_number'),
        getMessage('plin_name'),
        getMessage('whatsapp_number_pagos'),
        getMessage('whatsapp_number_cuenta'),
        getMessage('whatsapp_text_pagos'),
      ]);

      return {
        yape_number: yapeNum.data?.trim() || '',
        yape_name: yapeName.data?.trim() || '',
        plin_number: plinNum.data?.trim() || '',
        plin_name: plinName.data?.trim() || '',
        whatsapp_pagos: waPagos.data?.trim() || waFallback.data?.trim() || '',
        whatsapp_pagos_text:
          waText.data ||
          'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
      };
    },
    enabled: !!pedido.conDeuda,
  });

  const enviarComprobanteWA = () => {
    if (!configPagos?.whatsapp_pagos) return;

    // eslint-disable-next-line no-useless-escape
    const cleanNum = configPagos.whatsapp_pagos.replace(/[^\d\+]/g, '');
    const num = cleanNum.startsWith('+') ? cleanNum : `+51${cleanNum}`;

    let baseText = configPagos.whatsapp_pagos_text;
    baseText = baseText
      .replace('{id}', pedido.id)
      .replace('{monto}', pedido.montoDeuda ?? '0.00');

    const link = `https://wa.me/${num.replace('+', '')}?text=${encodeURIComponent(baseText)}`;
    window.open(link, '_blank');
  };

  const handleVerBoleta = async () => {
    setShowBoletaModal(true);

    if (boletas.length === 0) {
      setLoadingBoletas(true);
      setBoletaError(null);

      const { urls, error } = await listFilesInFolder(`00${pedido.id}`);

      setLoadingBoletas(false);

      if (error) {
        setBoletaError(error);
      } else {
        setBoletas(urls);
      }
    }
  };

  const handleVerBoletasEnvio = async () => {
    setShowBoletasEnvioModal(true);

    if (boletasEnvio !== null) return;

    setLoadingBoletasEnvio(true);

    // 1. Priorizar lectura rápida desde Firestore (según boletas_envio_storage.md)
    if (
      pedido.reparto?.boletasEnvio &&
      Array.isArray(pedido.reparto.boletasEnvio) &&
      pedido.reparto.boletasEnvio.length > 0
    ) {
      setBoletasEnvio(pedido.reparto.boletasEnvio.map((b) => b.url || b));
      setLoadingBoletasEnvio(false);
      return;
    }

    // 2. Fallback: buscar en Storage directamente (compatibilidad con datos legacy)
    let { urls, error } = await listFilesInFolder(`boletas_envio/00${pedido.id}`);

    if (error || urls.length === 0) {
      const fallback = await listFilesInFolder(`boletas_envio/${pedido.id}`);
      urls = fallback.urls || [];
    }

    setBoletasEnvio(urls);
    setLoadingBoletasEnvio(false);
  };

  return (
    <>
      {pedido.conDeuda ? (
        <div className={`${styles.banner} ${styles.bannerDeuda}`}>
          <AlertTriangle className={styles.bannerIcono} aria-hidden="true" />
          <div className={styles.bannerTextos}>
            <span className={styles.bannerLabel}><T>Saldo pendiente</T></span>
            <span className={styles.bannerMonto}>S/ {pedido.montoDeuda ?? '0.00'}</span>
          </div>
          <button type="button" className={styles.btnPagar} onClick={() => setShowPagoModal(true)}>
            <T>Pagar</T>
          </button>
        </div>
      ) : (
        <div className={`${styles.banner} ${styles.bannerPagado}`}>
          <CheckCircle2 className={styles.bannerIcono} aria-hidden="true" />
          <div className={styles.bannerTextos}>
            <span className={styles.bannerLabel}><T>Pedido pagado</T></span>
            <span className={styles.bannerMonto}>S/ {pedido.montoTotal || '0.00'}</span>
          </div>
        </div>
      )}

      <div className={styles.accionesRow}>
        <button type="button" className={styles.accionLink} onClick={() => setShowHistorialModal(true)}>
          <T>Ver historial de pagos</T>
        </button>
        <button type="button" className={styles.accionLink} onClick={handleVerBoleta}>
          <T>Ver boleta / recibos</T>
        </button>
        <button type="button" className={styles.accionLink} onClick={handleVerBoletasEnvio}>
          <T>Fotos de envío</T>
        </button>
      </div>

      {(canClaimCoins || isCompleted) && (
        <div className={styles.monedasRow}>
          {canClaimCoins ? (
            <button
              type="button"
              className={styles.chipReclamar}
              onClick={handleClaimCoins}
              disabled={claimingCoins}
            >
              🪙 {claimingCoins ? <T>Reclamando...</T> : <T>Reclamar 10 monedas</T>}
            </button>
          ) : (
            <span className={styles.chipReclamado}>🪙 <T>Monedas reclamadas</T></span>
          )}
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showDeudaImpresionModal}
        title="Aviso de impresión"
        onClose={() => setShowDeudaImpresionModal(false)}
      >
        <p style={{ color: '#ef4444', fontWeight: 700 }}>{DEUDA_IMPRESION_MENSAJE}</p>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            className={styles.waBoton}
            onClick={() => {
              setShowDeudaImpresionModal(false);
              setShowPagoModal(true);
            }}
          >
            Ver Detalles de Pago
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showHistorialModal}
        title="Historial de Pagos"
        onClose={() => setShowHistorialModal(false)}
      >
        <HistorialPagos pedido={pedido} />
      </Modal>

      <Modal
        isOpen={showPagoModal}
        title="Pagar Saldo Pendiente"
        onClose={() => setShowPagoModal(false)}
      >
        <div className={styles.modalPagoInner}>
          <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>
            Monto a cancelar: <span style={{ color: '#ea580c' }}>S/ {pedido.montoDeuda ?? '0.00'}</span>
          </p>

          {!configPagos ? (
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
              Cargando información de pago...
            </p>
          ) : (
            <div className={styles.opcionesPago}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#334155', fontSize: '0.95rem' }}>
                  Pago con Tarjeta (Recomendado)
                </h4>

                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Aprobación inmediata, no necesitas enviar comprobante.
                </p>

                <div style={{ marginTop: '-1rem' }}>
                  <CulqiCustomCheckout
                    pedido={pedido}
                    onSuccess={(details) => {
                      console.log('Pago de Culqi completado:', details);
                      setShowPagoModal(false);
                    }}
                  />

                  <PaypalCheckout
                    pedido={pedido}
                    onSuccess={(details) => {
                      console.log('Pago de PayPal completado:', details);
                      setShowPagoModal(false);
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span style={{ padding: '0 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  o transferencia local
                </span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {configPagos.yape_number && (
                  <div className={styles.metodoPago}>
                    <img src="https://i.imgur.com/gK1NpxI.png" alt="Yape" style={{ width: 50 }} />

                    <div>
                      <strong style={{ fontSize: '1rem', color: '#333' }}>{configPagos.yape_number}</strong>

                      {configPagos.yape_name && (
                        <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>
                          {configPagos.yape_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {configPagos.plin_number && (
                  <div className={styles.metodoPago}>
                    <img src="https://i.imgur.com/K1R9Ifn.png" alt="Plin" style={{ width: 50 }} />

                    <div>
                      <strong style={{ fontSize: '1rem', color: '#333' }}>{configPagos.plin_number}</strong>

                      {configPagos.plin_name && (
                        <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>
                          {configPagos.plin_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!configPagos.yape_number && !configPagos.plin_number && (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                    Transferencias no disponibles.
                  </p>
                )}

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className={styles.waBoton}
                    onClick={enviarComprobanteWA}
                    disabled={!configPagos.whatsapp_pagos}
                    style={
                      !configPagos.whatsapp_pagos
                        ? { opacity: 0.5, cursor: 'not-allowed', padding: '0.75rem', fontSize: '0.9rem' }
                        : { padding: '0.75rem', fontSize: '0.9rem' }
                    }
                  >
                    🚀 Enviar comprobante
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showBoletaModal}
        title={`Boleta del Pedido #${pedido.id}`}
        onClose={() => setShowBoletaModal(false)}
      >
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          {loadingBoletas ? (
            <p style={{ color: '#666' }}>Buscando boletas...</p>
          ) : boletaError ? (
            <p style={{ color: '#ef4444' }}><T>Error al cargar boletas.</T></p>
          ) : boletas.length === 0 ? (
            <div style={{ color: '#666', padding: '2rem 0' }}>
              <span style={{ fontSize: '3rem', opacity: 0.2, margin: '0 auto 1rem', display: 'block' }}>
                📄
              </span>

              <p><T>Aún no hay boletas adjuntas a este pedido.</T></p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {boletas.map((url, index) => (
                <div
                  key={index}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}
                >
                  <img src={url} alt={`Boleta ${index + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showBoletasEnvioModal}
        title="Fotos de envío"
        onClose={() => setShowBoletasEnvioModal(false)}
      >
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          {loadingBoletasEnvio ? (
            <p style={{ color: '#666' }}><T>Buscando fotos de boletas...</T></p>
          ) : boletasEnvio && boletasEnvio.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {boletasEnvio.map((url, index) => (
                <div
                  key={index}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}
                >
                  <img src={url} alt={`Boleta de envío ${index + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
              ))}
            </div>
          ) : (
            <p><T>Aún no hay boletas adjuntas.</T></p>
          )}
        </div>
      </Modal>
    </>
  );
};

export default PedidoAcciones;
