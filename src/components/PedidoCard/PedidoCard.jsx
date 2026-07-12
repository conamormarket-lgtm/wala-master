import React, { useState } from 'react';
import ImageGallery from '../ImageGallery';
import Timeline from '../Timeline';
import DetalleEtapaModal from '../Timeline/DetalleEtapaModal';
import Modal from '../common/Modal';
import HistorialPagos from './HistorialPagos';
import PaypalCheckout from '../PaypalCheckout';
import CulqiCustomCheckout from '../CulqiCustomCheckout';
import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../../services/messages';
import { getEtapaBadgeLabel, ETAPAS_TIMELINE, estadoToKey, getQueueStage } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { showFlyingCoins } from '../../utils/animations';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { listFilesInFolder } from '../../services/firebase/storage';
import styles from './PedidoCard.module.css';

const DEUDA_IMPRESION_MENSAJE = 'STOP... TIENES UNA DEUDA PENDIENTE, POR FAVOR REALIZA TU PAGO PARA QUE TU PEDIDO PUEDA CONTINUAR AVANZANDO';

const PedidoCard = ({ pedido, onImageClick, brandsMap }) => {
  const { userProfile, claimMonedas } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [etapaModal, setEtapaModal] = useState(null);
  const [showDeudaImpresionModal, setShowDeudaImpresionModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showBoletaModal, setShowBoletaModal] = useState(false);
  const [boletas, setBoletas] = useState([]);
  const [loadingBoletas, setLoadingBoletas] = useState(false);
  const [boletaError, setBoletaError] = useState(null);
  const [claimingCoins, setClaimingCoins] = useState(false);
  const [coinClaimedLocal, setCoinClaimedLocal] = useState(false);
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

  const handleClaimCoins = async (e) => {
    e.preventDefault();
    e.stopPropagation();

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

  const getMarcaLogoPath = (marcaName) => {
    if (!marcaName || typeof marcaName !== 'string') return '/logo-wala.svg';

    const targetName = marcaName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (brandsMap && brandsMap.has(targetName)) return brandsMap.get(targetName);

    return '/logo-wala.svg';
  };

  const handleDeudaClick = (e) => {
    e.stopPropagation();

    if (pedido.conDeuda) {
      setShowPagoModal(true);
    }
  };

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

  const handleVerBoleta = async (e) => {
    e.stopPropagation();

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

  const fetchBoletasEnvio = async () => {
    setLoadingBoletasEnvio(true);

    // 1. Priorizar lectura rápida desde Firestore (según boletas_envio_storage.md)
    if (
      pedido.reparto?.boletasEnvio &&
      Array.isArray(pedido.reparto.boletasEnvio) &&
      pedido.reparto.boletasEnvio.length > 0
    ) {
      const urlsFromFirestore = pedido.reparto.boletasEnvio.map((b) => b.url || b);
      setBoletasEnvio(urlsFromFirestore);
      setLoadingBoletasEnvio(false);
      return;
    }

    // 2. Fallback: buscar en Storage directamente (para compatibilidad con datos legacy)
    let { urls, error } = await listFilesInFolder(`boletas_envio/00${pedido.id}`);

    if (error || urls.length === 0) {
      const fallback = await listFilesInFolder(`boletas_envio/${pedido.id}`);
      urls = fallback.urls || [];
    }

    setBoletasEnvio(urls);
    setLoadingBoletasEnvio(false);
  };

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded;

    setIsExpanded(nextExpanded);

    if (nextExpanded && estadoToKey(pedido.estadoGeneral) === 'impresion' && pedido.conDeuda) {
      setShowDeudaImpresionModal(true);
    }

    if (nextExpanded && boletasEnvio === null) {
      fetchBoletasEnvio();
    }
  };

  let badgeLabel = getEtapaBadgeLabel(pedido.estadoGeneral);

  const getBadgeColor = (estadoKey) => {
    switch (estadoKey) {
      case 'finalizado':
        return '#10b981';
      case 'reparto':
      case 'impresion':
        return '#3b82f6';
      case 'preparacion':
      case 'preparación':
        return '#eab308';
      case 'estampado':
        return '#f97316';
      case 'empaquetado':
        return '#14b8a6';
      case 'anulado':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  let badgeBg = getBadgeColor(estadoToKey(pedido.estadoGeneral));

  // Parseo especial: si hay deuda y falta de stock (el estado incluye 'STOCK')
  const estadoStr = String(pedido.estadoGeneral || '').toUpperCase();
  const isProblemaStock = estadoStr.includes('STOCK');

  if (pedido.conDeuda && isProblemaStock) {
    badgeLabel = 'PAGAR DEUDA';
    badgeBg = '#ef4444';
  }

  return (
    <div className={styles.card}>
      {/* 1. Header (Siempre visible) */}
      <div className={styles.cardHeader} onClick={toggleExpanded}>
        <div className={styles.headerLeft}>
          <div
            className={styles.marcaBadgeContainer}
            title={pedido.marca ? `Marca: ${pedido.marca}` : 'Marca: Walá'}
          >
            <div className={styles.marcaBadge}>
              <img
                src={getMarcaLogoPath(pedido.marca)}
                alt={pedido.marca || 'Walá'}
                className={styles.marcaLogoImg}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/logo-wala.svg';
                }}
              />
            </div>
          </div>

          <div className={styles.headerTitleGroup}>
            <div className={styles.titleRow}>
              <span className={styles.headerTitle}>Pedido: #{pedido.id}</span>

              {pedido.numeroColaDisplay != null &&
                pedido.numeroColaDisplay !== '' &&
                getQueueStage(pedido.estadoGeneral) && (
                  <span className={styles.colaBadge}>🎟️ {pedido.numeroColaDisplay}</span>
                )}
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.badgesScrollable}>
            <span className={pedido.conDeuda ? styles.deudaChipCon : styles.deudaChipSin}>
              {pedido.conDeuda ? 'DEUDA' : 'SIN DEUDA'}
            </span>

            <span className={styles.badge} style={{ backgroundColor: badgeBg }}>
              {badgeLabel}
            </span>

            {canClaimCoins ? (
              <button
                type="button"
                className={`${styles.reclamarChip} ${claimingCoins ? styles.claiming : ''}`}
                onClick={handleClaimCoins}
                disabled={claimingCoins}
              >
                🪙 {claimingCoins ? 'Reclamando...' : 'Reclamar 10 monedas'}
              </button>
            ) : (
              isCompleted && (
                <span className={styles.canjeadoChip}>
                  🪙 Reclamado
                </span>
              )
            )}
          </div>

          {isExpanded ? (
            <ChevronUp size={20} className={styles.iconoChevron} />
          ) : (
            <ChevronDown size={20} className={styles.iconoChevron} />
          )}
        </div>
      </div>

      {/* 2. Body (Desplegable) */}
      <div className={`${styles.cardBody} ${isExpanded ? styles.expanded : ''}`}>
        {/* SECCIÓN A: INFORMACIÓN */}
        <div className={styles.sectionTitle}>INFORMACIÓN</div>

        <div className={styles.legacyInfoGrid}>
          <div className={styles.infoPanel}>
            <h3>Datos del cliente</h3>

            <dl className={styles.infoList}>
              <div>
                <dt>Cliente</dt>
                <dd>{pedido.nombreCliente || 'No disponible'}</dd>
              </div>

              <div>
                <dt>Marca</dt>
                <dd>{pedido.marca || 'Walá'}</dd>
              </div>

              <div>
                <dt>Destino</dt>
                <dd>{pedido.direccion || 'No disponible'}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.infoPanel}>
            <h3>Datos de envío</h3>

            <dl className={styles.infoList}>
              <div>
                <dt>Provincia</dt>
                <dd>{pedido.envioProvincia ?? '—'}</dd>
              </div>

              <div>
                <dt>Ciudad</dt>
                <dd>{pedido.envioCiudad ?? '—'}</dd>
              </div>

              <div>
                <dt>Distrito</dt>
                <dd>{pedido.envioDistrito ?? pedido.distrito ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.infoPanel}>
            <h3>Datos de la agencia</h3>

            <dl className={styles.infoList}>
              <div>
                <dt>Agencia</dt>
                <dd>{pedido.agenciaEnvio ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.infoPanel}>
            <h3>Montos y resumen</h3>

            <dl className={styles.infoList}>
              <div>
                <dt>Fecha de Compra</dt>
                <dd>{pedido.fechaCompra || 'N/A'}</dd>
              </div>

              <div>
                <dt>Tallas/Desc</dt>
                <dd>{pedido.tallas || 'N/A'}</dd>
              </div>

              <div>
                <dt>Adelantado</dt>
                <dd>S/ {pedido.montoAdelantado || '0.00'}</dd>
              </div>

              <div>
                <dt>Total</dt>
                <dd>S/ {pedido.montoTotal || '0.00'}</dd>
              </div>

              <div>
                <dt>Deuda</dt>
                <dd className={pedido.conDeuda ? styles.deudaValue : styles.sinDeudaValue}>
                  {pedido.conDeuda ? `S/ ${pedido.montoDeuda ?? '0.00'}` : 'Sin deuda'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className={`${styles.alertaDeuda} ${pedido.conDeuda ? styles.danger : styles.success}`}>
          <div className={styles.deudaTextBlock}>
            {pedido.conDeuda ? (
              <AlertTriangle className={styles.deudaIcono} />
            ) : (
              <CheckCircle2 className={styles.deudaIcono} />
            )}

            <div>
              <div className={styles.deudaLabel}>
                {pedido.conDeuda ? 'Saldo Pendiente' : 'Pedido Pagado'}
              </div>

              <div className={styles.deudaResumen}>
                Total: S/ {pedido.montoTotal || '0.00'} | Adelanto: S/ {pedido.montoAdelantado || '0.00'}
              </div>
            </div>
          </div>

          {pedido.conDeuda && (
            <div className={styles.btnPagoWrapper}>
              <div className={styles.montoDeuda}>S/ {pedido.montoDeuda ?? '0.00'}</div>
              <button className={styles.verPagosBtn} onClick={handleDeudaClick}>
                Pagar
              </button>
            </div>
          )}

          {!pedido.conDeuda && (
            <button
              className={styles.verPagosBtn}
              style={{ borderColor: '#bbf7d0', color: '#166534' }}
              onClick={(e) => {
                e.stopPropagation();
                setShowHistorialModal(true);
              }}
            >
              Ver Pagos
            </button>
          )}
        </div>

        {pedido.conDeuda && (
          <div className={styles.linkRow}>
            <button
              className={styles.linkButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowHistorialModal(true);
              }}
            >
              Ver Historial de Pagos Anteriores
            </button>
          </div>
        )}

        <div className={styles.linkRow}>
          <button className={styles.linkButtonBlue} onClick={handleVerBoleta}>
            📄 Ver Boleta / Recibos
          </button>
        </div>

        {/* SECCIÓN C: GALERÍA */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionTitle}>GALERÍA DE DISEÑOS</div>

        <ImageGallery
          images={pedido.imageURLs}
          onImageClick={(index) => onImageClick(pedido.imageURLs, index)}
        />

        {/* SECCIÓN D: TIMELINE */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionTitle}>LÍNEA DE TIEMPO</div>

        <Timeline
          fechas={pedido.fechas}
          fechaCompra={pedido.fechaCompra}
          pedido={pedido}
          onEtapaClick={(key) => setEtapaModal(key)}
        />

        {/* SECCIÓN E: BOLETAS DE ENVÍO */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionTitle}>FOTO DE BOLETAS DE ENVÍO</div>

        <div className={styles.boletasEnvioBox}>
          {loadingBoletasEnvio ? (
            <p>Buscando fotos de boletas...</p>
          ) : boletasEnvio && boletasEnvio.length > 0 ? (
            <ImageGallery
              images={boletasEnvio}
              onImageClick={(index) => onImageClick(boletasEnvio, index)}
            />
          ) : (
            <p>Aún no hay boletas adjuntas.</p>
          )}
        </div>

      </div>

      {/* Modals Footer */}
      {etapaModal && (
        <Modal
          isOpen={!!etapaModal}
          title={ETAPAS_TIMELINE.find((e) => e.key === etapaModal)?.nombre ?? etapaModal}
          onClose={() => setEtapaModal(null)}
        >
          <DetalleEtapaModal etapaKey={etapaModal} pedido={pedido} />
        </Modal>
      )}

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
              {/* SECCIÓN 1: Tarjetas */}
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

              {/* SECCIÓN 2: Transferencias / Yape / Plin */}
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
            <p style={{ color: '#ef4444' }}>Error al cargar boletas.</p>
          ) : boletas.length === 0 ? (
            <div style={{ color: '#666', padding: '2rem 0' }}>
              <span style={{ fontSize: '3rem', opacity: 0.2, margin: '0 auto 1rem', display: 'block' }}>
                📄
              </span>

              <p>Aún no hay boletas adjuntas a este pedido.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {boletas.map((url, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={url}
                    alt={`Boleta ${index + 1}`}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PedidoCard;