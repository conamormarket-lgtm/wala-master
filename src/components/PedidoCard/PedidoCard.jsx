import React, { useState } from 'react';
import ImageGallery from '../ImageGallery';
import Timeline from '../Timeline';
import DetalleEtapaModal from '../Timeline/DetalleEtapaModal';
import Modal from '../common/Modal';
import HistorialPagos from './HistorialPagos';
import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../../services/messages';
import { getEtapaBadgeLabel, ETAPAS_TIMELINE, estadoToKey, getQueueStage } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { showFlyingCoins } from '../../utils/animations';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, User, MapPin, Building, Flag, AlertCircle, ShoppingCart } from 'lucide-react';
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

  const completedEstados = ['finalizado', 'entregado', 'completado'];
  const isCompleted = completedEstados.includes(estadoToKey(pedido.estadoGeneral));
  const reclamadas = userProfile?.monedasReclamadas || [];
  const canClaimCoins = isCompleted && !reclamadas.includes(pedido.id);

  const handleClaimCoins = async (e) => {
    e.stopPropagation();
    if (claimingCoins) return;
    setClaimingCoins(true);
    try {
      const rect = e.target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top;
      const res = await claimMonedas(pedido.id, 10);
      if (!res.error) showFlyingCoins(x, y);
    } finally {
      setClaimingCoins(false);
    }
  };

  const { data: configPagos } = useQuery({
    queryKey: ['user-pagos-config'],
    queryFn: async () => {
      const [yapeNum, yapeName, plinNum, plinName, waPagos, waFallback, waText] = await Promise.all([
        getMessage('yape_number'), getMessage('yape_name'), getMessage('plin_number'), getMessage('plin_name'), 
        getMessage('whatsapp_number_pagos'), getMessage('whatsapp_number_cuenta'), getMessage('whatsapp_text_pagos')
      ]);
      return {
        yape_number: yapeNum.data?.trim() || '',
        yape_name: yapeName.data?.trim() || '',
        plin_number: plinNum.data?.trim() || '',
        plin_name: plinName.data?.trim() || '',
        whatsapp_pagos: waPagos.data?.trim() || waFallback.data?.trim() || '',
        whatsapp_pagos_text: waText.data || 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
      };
    },
    enabled: !!pedido.conDeuda,
  });

  const getMarcaLogoPath = (marcaName) => {
    if (!marcaName || typeof marcaName !== 'string') return '/logo-wala.svg';
    const targetName = marcaName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (brandsMap && brandsMap.has(targetName)) return brandsMap.get(targetName);
    return '/logo-wala.svg';
  };

  const handleDeudaClick = (e) => {
    e.stopPropagation();
    if (pedido.conDeuda) setShowPagoModal(true);
  };

  const enviarComprobanteWA = () => {
    if (!configPagos?.whatsapp_pagos) return;
    const cleanNum = configPagos.whatsapp_pagos.replace(/[^\d\+]/g, '');
    const num = cleanNum.startsWith('+') ? cleanNum : `+51${cleanNum}`;
    let baseText = configPagos.whatsapp_pagos_text;
    baseText = baseText.replace('{id}', pedido.id).replace('{monto}', pedido.montoDeuda ?? '0.00');
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

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    if (nextExpanded && estadoToKey(pedido.estadoGeneral) === 'impresion' && pedido.conDeuda) {
      setShowDeudaImpresionModal(true);
    }
  };

  const badgeLabel = getEtapaBadgeLabel(pedido.estadoGeneral);
  
  const getBadgeColor = (estadoKey) => {
    switch(estadoKey) {
       case 'finalizado': return '#10b981'; // emerald-500
       case 'reparto': case 'impresion': return '#3b82f6'; // blue-500
       case 'preparacion': case 'preparación': return '#eab308'; // yellow-500
       case 'estampado': return '#f97316'; // orange-500
       case 'empaquetado': return '#14b8a6'; // teal-500
       case 'anulado': return '#ef4444'; // red-500
       default: return '#8b5cf6'; // violet-500 (pendiente/diseno)
    }
  };
  const badgeBg = getBadgeColor(estadoToKey(pedido.estadoGeneral));

  const notes = pedido.detallesEtapas?.compra?.observación || pedido.observacion || '';



  return (
    <div className={styles.card}>
      {/* 1. Header (Siempre visible) */}
      <div className={styles.cardHeader} onClick={toggleExpanded}>
        <div className={styles.headerLeft}>
          <div className={styles.marcaBadgeContainer} title={pedido.marca ? `Marca: ${pedido.marca}` : 'Marca: Walá'}>
            <div className={styles.marcaBadge}>
              <img 
                src={getMarcaLogoPath(pedido.marca)} 
                alt={pedido.marca || 'Walá'} 
                className={styles.marcaLogoImg}
                onError={(e) => { e.target.onerror = null; e.target.src = '/logo-wala.svg'; }}
              />
            </div>
          </div>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerTitle}>Pedido: #{pedido.id}</span>
            {pedido.numeroColaDisplay != null && pedido.numeroColaDisplay !== '' && getQueueStage(pedido.estadoGeneral) && (
              <span className={styles.colaBadge}>🎟️ {pedido.numeroColaDisplay}</span>
            )}
          </div>
        </div>
        
        <div className={styles.headerRight}>
          {canClaimCoins && (
            <button 
              type="button" 
              className={`${styles.reclamarChip} ${claimingCoins ? styles.claiming : ''}`}
              onClick={handleClaimCoins}
              title="Ganar 10 monedas"
            >
             🪙 Reclamar
            </button>
          )}
          {isCompleted && !canClaimCoins && <span className={styles.canjeadoChip}>🪙 Reclamado</span>}
          
          <span className={pedido.conDeuda ? styles.deudaChipCon : styles.deudaChipSin}>
            {pedido.conDeuda ? 'DEUDA' : 'SIN DEUDA'}
          </span>

          <span className={styles.badge} style={{ backgroundColor: badgeBg }}>
            {badgeLabel}
          </span>
          {isExpanded ? <ChevronUp size={20} className={styles.iconoChevron} /> : <ChevronDown size={20} className={styles.iconoChevron} />}
        </div>
      </div>

      {/* 2. Body (Desplegable) */}
      <div className={`${styles.cardBody} ${isExpanded ? styles.expanded : ''}`}>
        
        {/* SECCIÓN D: TIMELINE */}
        <div className={styles.sectionTitle} style={{ marginTop: 0 }}><Flag size={16} /> Etapa del Pedido</div>
        <Timeline
          fechas={pedido.fechas}
          fechaCompra={pedido.fechaCompra}
          pedido={pedido}
          onEtapaClick={(key) => setEtapaModal(key)}
        />

        {/* SECCIÓN C: GALERÍA */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionTitle}><Building size={16} /> Galería de Diseños</div>
        <ImageGallery 
          images={pedido.imageURLs} 
          onImageClick={(index) => onImageClick(pedido.imageURLs, index)}
        />

        {/* SECCIÓN A: INFORMACIÓN */}
        <div className={styles.sectionDivider} />
        <div className={styles.sectionTitle}><User size={16} /> Información del Cliente</div>
        
        <div className={styles.infoGrid}>
          <div className={styles.dataRow}>
            <span className={styles.dataKey}>Cliente:</span>
            <span className={styles.dataValue}>{pedido.nombreCliente || 'No disponible'}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataKey}>Marca:</span>
            <span className={styles.dataValue}>{pedido.marca || 'Walá'}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataKey}>Fecha de Compra:</span>
            <span className={styles.dataValue}>{pedido.fechaCompra || 'N/A'}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataKey}>Tallas / Desc:</span>
            <span className={styles.dataValue}>{pedido.tallas || 'N/A'}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.dataKey}>Destino:</span>
            <span className={styles.dataValue}>{pedido.direccion || 'No disponible'}</span>
          </div>

          <div className={styles.envioBox}>
             <div className={styles.sectionTitle} style={{ marginBottom: '0.75rem', marginTop: 0 }}><MapPin size={16}/> Datos de Envío</div>
             <div className={styles.envioGrid}>
                <div className={styles.dataRow}>
                  <span className={styles.dataKey}>Provincia</span>
                  <span className={styles.dataValue}>{pedido.envioProvincia ?? '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.dataKey}>Ciudad</span>
                  <span className={styles.dataValue}>{pedido.envioCiudad ?? '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.dataKey}>Agencia</span>
                  <span className={styles.dataValue}>{pedido.agenciaEnvio ?? '—'}</span>
                </div>
             </div>
          </div>

          {/* Alerta de Deuda */}
          <div className={`${styles.alertaDeuda} ${pedido.conDeuda ? styles.danger : styles.success}`}>
            <div className={styles.deudaTextBlock}>
              {pedido.conDeuda ? <AlertTriangle className={styles.deudaIcono} /> : <CheckCircle2 className={styles.deudaIcono} />}
              <div>
                <div className={styles.deudaLabel}>
                  {pedido.conDeuda ? 'Saldo Pendiente' : 'Pedido Pagado'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Total: S/ {pedido.montoTotal || '0.00'} | Adelanto: S/ {pedido.montoAdelantado || '0.00'}
                </div>
              </div>
            </div>
            
            {pedido.conDeuda && (
              <div className={styles.btnPagoWrapper}>
                <div className={styles.montoDeuda}>S/ {pedido.montoDeuda ?? '0.00'}</div>
                <button className={styles.verPagosBtn} onClick={handleDeudaClick}>Pagar</button>
              </div>
            )}
            {!pedido.conDeuda && (
               <button className={styles.verPagosBtn} style={{ borderColor: '#bbf7d0', color: '#166534' }} onClick={() => setShowHistorialModal(true)}>Ver Pagos</button>
            )}
          </div>
          {pedido.conDeuda && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                <button className={styles.verPagosBtn} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', border: 'none', textDecoration: 'underline', color: '#64748b', background: 'transparent' }} onClick={() => setShowHistorialModal(true)}>
                  Ver Historial de Pagos Anteriores
                </button>
             </div>
          )}
          <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: '-0.5rem' }}>
              <button 
                className={styles.verPagosBtn} 
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', border: 'none', textDecoration: 'underline', color: '#3b82f6', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '4px', float: 'right' }} 
                onClick={handleVerBoleta}
              >
                📄 Ver Boleta / Recibos
              </button>
          </div>
        </div>

        {/* SECCIÓN B: NOTAS */}
        {notes && (
          <>
            <div className={styles.sectionDivider} />
            <div className={styles.sectionTitle}><AlertCircle size={16}/> Notas y Alertas</div>
            <div className={styles.notaBox}>
               <AlertTriangle size={20} className={styles.notaIcono} />
               <div>{notes}</div>
            </div>
          </>
        )}



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
          <button className={styles.waBoton} onClick={() => {
            setShowDeudaImpresionModal(false);
            setShowPagoModal(true);
          }}>
            Ver Detalles de Pago
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showHistorialModal}
        title={`Historial de Pagos`}
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
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>Cargando información de pago...</p>
          ) : (
            <div className={styles.opcionesPago}>
              {configPagos.yape_number && (
                <div className={styles.metodoPago}>
                  <img src="https://i.imgur.com/gK1NpxI.png" alt="Yape" style={{ width: 60 }} />
                  <div>
                    <strong style={{ fontSize: '1.15rem', color: '#333' }}>{configPagos.yape_number}</strong>
                    {configPagos.yape_name && <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>{configPagos.yape_name}</p>}
                  </div>
                </div>
              )}
              {configPagos.plin_number && (
                <div className={styles.metodoPago}>
                  <img src="https://i.imgur.com/K1R9Ifn.png" alt="Plin" style={{ width: 60 }} />
                  <div>
                    <strong style={{ fontSize: '1.15rem', color: '#333' }}>{configPagos.plin_number}</strong>
                    {configPagos.plin_name && <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>{configPagos.plin_name}</p>}
                  </div>
                </div>
              )}

              {(!configPagos.yape_number && !configPagos.plin_number) && (
                <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>Las cuentas de pago no están configuradas temporalmente.</p>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', textAlign: 'center' }}>
                  Una vez realizado el depósito, por favor envíanos la captura:
                </p>
                <button 
                  className={styles.waBoton}
                  onClick={enviarComprobanteWA}
                  disabled={!configPagos.whatsapp_pagos}
                  style={!configPagos.whatsapp_pagos ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                   🚀 Enviar comprobante por WhatsApp
                </button>
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
              <span style={{ fontSize: '3rem', opacity: 0.2, margin: '0 auto 1rem', display: 'block' }}>📄</span>
              <p>Aún no hay boletas adjuntas a este pedido.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {boletas.map((url, index) => (
                <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={url} alt={`Boleta ${index + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
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
