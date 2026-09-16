import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Link2,
  Copy,
  Check,
  Coins,
  MousePointerClick,
  ShoppingBag,
  Send,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  getReferralsByReferrer,
  createReferralShare,
  claimReferralCoins,
  estimateReferralReward,
} from '../../services/referrals';
import ReferralRanking from '../../components/analytics/ReferralRanking';
import { GlassCard, Reveal, Stagger, StaggerItem } from '../../components/ui';
import styles from './CuentaReferidosPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const STAGES = {
  sent: 1,
  clicked: 2,
  purchased: 3,
  completed: 4,
  claimed: 4,
  ineligible: 3,
};

// Etiquetas del stepper. Antes eran cuatro palabras sueltas ("Enviado / Clic /
// Compra / Reclamar") sin decir de quién es cada acción; con el sujeto delante
// se entiende de un vistazo que las dos del medio dependen de la otra persona.
const PASOS = [
  { key: 'sent', label: 'Enlace creado' },
  { key: 'clicked', label: 'Entró al link' },
  { key: 'purchased', label: 'Compró' },
  { key: 'claimed', label: 'Reclamas' },
];

// Ventana para comprar, contada desde que la otra persona ABRE el enlace (no
// desde que se genera: el enlace en sí no caduca). Es el mismo plazo que
// aplican ReferralTracker.jsx -guarda el clic en el localStorage del visitante-
// y CheckoutPage.jsx, que solo vincula la compra si el clic sigue dentro de él.
const VENTANA_COMPRA_MS = 36 * 60 * 60 * 1000;

// "12 h 30 min" / "45 min" / "menos de 1 min". Devuelve null si ya venció.
const restanteLegible = (ms) => {
  if (!(ms > 0)) return null;
  const totalMin = Math.floor(ms / 60000);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  if (horas > 0) return `${horas} h ${minutos} min`;
  if (totalMin > 0) return `${totalMin} min`;
  return 'menos de 1 min';
};

const CuentaReferidosPage = () => {
  const { userProfile } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const referralCode = userProfile?.referralCode || '';

  const { data: referrals, isLoading } = useQuery({
    queryKey: ['myReferrals', referralCode],
    queryFn: async () => {
      const res = await getReferralsByReferrer(referralCode);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: !!referralCode,
  });

  // Notificaciones al cargar la página (música figurativa)
  useEffect(() => {
    if (referrals && referrals.length > 0) {
      // Mostrar notificaciones de las actividades más recientes (últimos 3 días)
      const now = new Date();
      const recent = referrals.filter(r => {
        const d = r.updatedAt?.toDate() || r.createdAt?.toDate();
        if (!d) return false;
        return (now - d) / (1000 * 60 * 60 * 24) <= 3;
      });

      const unnotifiedKey = 'notified_referrals_' + referralCode;
      const notifiedStr = localStorage.getItem(unnotifiedKey) || '[]';
      const notified = JSON.parse(notifiedStr);
      let newNotified = [...notified];

      recent.forEach(r => {
        if (!notified.includes(r.id + '_' + r.status)) {
          if (r.status === 'clicked') {
            toast.info('👀 Alguien acaba de ver un producto desde tu enlace.');
          } else if (r.status === 'purchased' || r.status === 'completed') {
            toast.success('🎉 ¡Vendiste! Alguien compró por tu enlace.');
          }
          newNotified.push(r.id + '_' + r.status);
        }
      });

      if (newNotified.length > notified.length) {
        localStorage.setItem(unnotifiedKey, JSON.stringify(newNotified));
      }
    }
  }, [referrals, referralCode, toast]);

  // El enlace de un referido se puede reconstruir en cualquier momento: el
  // `shareId` ES el id del documento de `referrals`, así que cada fila del
  // historial sabe cuál era su enlace. Por eso olvidarse de mandarlo no
  // obliga a generar otro (que gastaría uno del cupo de 50 al mes).
  const buildShareUrl = (shareId) =>
    `${window.location.origin}?ref=${referralCode}&shareId=${shareId}`;

  const copyShareUrl = (shareId) =>
    navigator.clipboard.writeText(buildShareUrl(shareId))
      .then(() => toast.success('¡Enlace copiado! Mándaselo a una sola persona.'))
      .catch(() => toast.error('Error copiando al portapapeles'));

  const generateLink = async () => {
    if (!referralCode) return;
    setGenerating(true);
    const { id, error } = await createReferralShare(referralCode);
    if (error) {
      toast.error('Error al generar enlace');
      setGenerating(false);
      return;
    }

    // react-query v5 espera un objeto de filtros. Con el array suelto que
    // había antes, `filters.queryKey` quedaba undefined y se invalidaba TODA
    // la caché de la app (productos, pedidos…), no solo esta lista.
    queryClient.invalidateQueries({ queryKey: ['myReferrals', referralCode] });

    await copyShareUrl(id);
    setGenerating(false);
  };

  const handleClaim = async (referralDoc) => {
    if (!['completed', 'purchased'].includes(referralDoc.status)) return;

    // claimReferralCoins solo necesita el id: el monto real (5%/10% del
    // pedido) lo calcula y valida claimReferralSecure server-side contra el
    // ERP, no lo que haya en earnedCoins/monedas del cliente.
    setClaimingId(referralDoc.id);
    const { earned, error } = await claimReferralCoins(referralDoc.id);
    setClaimingId(null);

    if (error) {
      // Para 'purchased' (sin aprobación de Admin) es normal que el ERP
      // todavía no marque el pedido como finalizado — mostrar el motivo
      // real del servidor en vez de un genérico ayuda a entender por qué.
      toast.error(error || 'Error al reclamar monedas');
    } else {
      toast.success(`¡Has reclamado ${earned ?? ''} monedas con éxito!`);
      queryClient.invalidateQueries({ queryKey: ['myReferrals', referralCode] });
      // También se actualiza el userProfile globalmente a través del effect en AuthContext
    }
  };

  const copyCodeOnly = () => {
    navigator.clipboard.writeText(referralCode)
      .then(() => toast.success('Código copiado'))
      .catch(() => toast.error('Error al copiar'));
  };

  // Cálculos de estadísticas.
  // Ojo con el vocabulario: cada documento de `referrals` es UN enlace
  // generado, no una persona. Por eso no son "visitas" (un mismo enlace
  // abierto diez veces sigue siendo un documento en estado 'clicked'), sino
  // enlaces que alguien llegó a abrir.
  const enlacesTotales = referrals?.length || 0;
  const enlacesAbiertos = referrals?.filter(r => STAGES[r.status] >= 2).length || 0;
  const totalCompras = referrals?.filter(r => STAGES[r.status] >= 3 && r.status !== 'ineligible').length || 0;
  const totalMonedas = referrals?.reduce((acc, r) => acc + (r.earnedCoins || 0), 0) || 0;
  const porReclamar = referrals?.filter(r => r.status === 'completed' || r.status === 'purchased').length || 0;

  // ¿Hay alguna ventana de 36 h corriendo ahora mismo? Solo en ese caso vale la
  // pena mantener un reloj vivo; cuando todas vencieron no queda nada que
  // contar y el intervalo se limpia solo.
  const hayCuentaRegresiva = (referrals || []).some(
    (r) => r.status === 'clicked'
      && (r.clickedAt?.toMillis?.() || 0) + VENTANA_COMPRA_MS > ahora
  );

  useEffect(() => {
    if (!hayCuentaRegresiva) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hayCuentaRegresiva]);

  return (
    <div className={styles.page}>
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <Users size={20} aria-hidden="true" />
            </div>
            <h2>Invita y gana monedas</h2>
          </div>
          <p className={styles.headerSub}>
            Comparte tu enlace. Cuando esa persona compra, ganas el{' '}
            <strong>5&nbsp;% de su compra en monedas</strong> — el{' '}
            <strong>10&nbsp;%</strong> si supera los S/&nbsp;200. Cada moneda vale
            S/&nbsp;1 de descuento.
          </p>

          {/* Cómo funciona: el flujo tiene cuatro pasos y dos de ellos dependen
              de la otra persona. Sin esto, el stepper del historial no se
              entiende hasta que ya pasó algo. */}
          <ol className={styles.pasos}>
            <li className={styles.paso}>
              <span className={styles.pasoNum}>1</span>
              <div>
                <p className={styles.pasoTitle}>Genera un enlace</p>
                <p className={styles.pasoText}>Uno por cada persona a la que se lo mandes.</p>
              </div>
            </li>
            <li className={styles.paso}>
              <span className={styles.pasoNum}>2</span>
              <div>
                <p className={styles.pasoTitle}>Esa persona compra</p>
                <p className={styles.pasoText}>Tiene 36 horas desde que abre tu enlace.</p>
              </div>
            </li>
            <li className={styles.paso}>
              <span className={styles.pasoNum}>3</span>
              <div>
                <p className={styles.pasoTitle}>Reclamas tus monedas</p>
                <p className={styles.pasoText}>Cuando el pedido queda entregado.</p>
              </div>
            </li>
          </ol>
        </GlassCard>
      </Reveal>

      {/* ── Código + generación de enlace ────────────────────────────────── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <p className={styles.codeLabel}>Tu código de referido</p>

          {/* El código es único y permanente: antes había un lápiz "Cambiar"
              que permitía editarlo una sola vez (referralCodeEdited). Se quitó
              a pedido — un código que puede cambiar deja enlaces ya compartidos
              apuntando a un código que ya no existe. */}
          <div className={styles.codeRow}>
            <span className={styles.codeText}>{referralCode || '—'}</span>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={copyCodeOnly}
              disabled={!referralCode}
            >
              <Copy size={15} aria-hidden="true" />
              Copiar código
            </button>
          </div>

          <p className={styles.codeNote}>Este es tu código y no cambia.</p>

          <div className={styles.generateRow}>
            <button
              type="button"
              className={`${styles.btnSolido} ${styles.btnGenerate}`}
              onClick={generateLink}
              disabled={generating || !referralCode}
            >
              <Link2 size={17} aria-hidden="true" />
              {generating ? 'Generando…' : 'Generar y copiar enlace'}
            </button>
            <p className={styles.generateHint}>
              El enlace se copia solo. Genera uno nuevo por cada persona: si mandas
              el mismo a varias, todas cuentan como un único referido.
            </p>
          </div>
        </GlassCard>
      </Reveal>

      {/* ── Marcadores ───────────────────────────────────────────────────── */}
      <Stagger className={styles.statsGrid}>
        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconViolet}`}>
              <MousePointerClick size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Enlaces abiertos</span>
            <span className={styles.statValue}>{enlacesAbiertos}</span>
            <span className={styles.statHint}>
              de {enlacesTotales} {enlacesTotales === 1 ? 'generado' : 'generados'}
            </span>
          </GlassCard>
        </StaggerItem>

        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <ShoppingBag size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Compras</span>
            <span className={styles.statValue}>{totalCompras}</span>
            <span className={styles.statHint}>
              {porReclamar > 0
                ? `${porReclamar} por reclamar`
                : 'Compras hechas con tus enlaces.'}
            </span>
          </GlassCard>
        </StaggerItem>

        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconGold}`}>
              <Coins size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Monedas ganadas</span>
            <span className={styles.statValue}>{totalMonedas}</span>
            <span className={styles.statHint}>
              Saldo actual: {userProfile?.monedas || 0}
            </span>
          </GlassCard>
        </StaggerItem>
      </Stagger>

      {/* ── Historial ────────────────────────────────────────────────────── */}
      <div className={styles.listHead}>
        <h3 className={styles.listTitle}><T>Historial de referidos</T></h3>
        {!isLoading && enlacesTotales > 0 && (
          <span className={styles.listCount}>
            {enlacesTotales} {enlacesTotales === 1 ? 'enlace' : 'enlaces'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className={styles.skeletonList} aria-hidden="true">
          {[1, 2].map((n) => (
            <div key={n} className={styles.skeletonItem} />
          ))}
        </div>
      ) : !referrals || referrals.length === 0 ? (
        <Reveal>
          <GlassCard variant="solid" padding="lg" animate={false} className={styles.empty} bodyClassName={styles.emptyBody}>
            <div className={styles.emptyIcon}>
              <Send size={26} aria-hidden="true" />
            </div>
            <p className={styles.emptyTitle}>Todavía no compartiste ningún enlace.</p>
            <p className={styles.emptyText}>
              Genera el primero aquí arriba y mándaselo a alguien que quiera regalar algo.
            </p>
          </GlassCard>
        </Reveal>
      ) : (
        // OJO: acá NO va <Stagger>/<StaggerItem>. El contenedor <Stagger>
        // revela a sus hijos con whileInView + viewport={{ once: true }}, y
        // <StaggerItem> no trae observador propio: depende de que el padre le
        // propague "show". Como el padre ya disparó su única pasada, las filas
        // que se montan DESPUÉS (justo lo que pasa al generar un enlace nuevo)
        // se quedaban en `opacity: 0; translateY(24px)` — un hueco en blanco
        // hasta recargar la página. <Reveal as="li"> monta su propio
        // observador por fila, así que una fila nueva se revela sola; la
        // cascada se conserva con el delay escalonado (tope de 6 para que una
        // lista larga no arranque con un segundo de espera).
        <ul className={styles.list}>
          {referrals.map((ref, i) => {
            const currentStage = STAGES[ref.status] || 1;
            // 'purchased' también puede reclamarse, no solo 'completed': ese
            // paso de Admin (AdminReferidos) es para ventas por WhatsApp, que
            // no pasan por linkPurchaseToReferral. Para las que SÍ se
            // registran solas (compra con el link ?ref=&shareId= del
            // checkout web), claimReferralSecure ya valida por su cuenta
            // contra el ERP -si el pedido aún no está finalizado, rechaza con
            // un mensaje claro (ver handleClaim)-, así que no hace falta
            // esperar una aprobación manual aparte.
            const canClaim = ref.status === 'completed' || ref.status === 'purchased';
            const isClaimed = ref.status === 'claimed';
            const isIneligible = ref.status === 'ineligible';
            // Antes de reclamar no hay earnedCoins confirmado (lo fija el
            // servidor recién al reclamar) — se muestra un estimado con la
            // misma fórmula que usa el backend.
            const esConfirmada = isClaimed || ref.status === 'completed';
            const gananciaMostrada = esConfirmada
              ? (ref.earnedCoins || 0)
              : estimateReferralReward(ref.orderTotal);

            // Lo que queda de la ventana de 36 h. Solo tiene sentido mientras
            // el referido está en 'clicked': antes de que abran el enlace no
            // hay reloj corriendo, y si ya compró el plazo dejó de importar.
            const clickMs = ref.clickedAt?.toMillis?.() || 0;
            const venceEnMs = ref.status === 'clicked' && clickMs
              ? clickMs + VENTANA_COMPRA_MS - ahora
              : null;
            const restante = venceEnMs == null ? null : restanteLegible(venceEnMs);
            const ventanaVencida = venceEnMs != null && !restante;

            const d = ref.clickedAt?.toDate() || ref.createdAt?.toDate();
            const dateStr = d ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : 'Sin fecha';

            return (
              <Reveal
                as="li"
                key={ref.id}
                delay={Math.min(i, 6) * 0.06}
                className={styles.listItem}
              >
                <GlassCard
                  as="article"
                  variant="solid"
                  padding="md"
                  animate={false}
                  className={`${styles.referralCard} ${isClaimed ? styles.cardClaimed : ''} ${isIneligible ? styles.cardIneligible : ''}`}
                  bodyClassName={styles.referralBody}
                >
                  <div className={styles.rowTop}>
                    <span className={styles.dateText}>{dateStr}</span>
                    <div className={styles.rowTags}>
                      {ref.orderId && (
                        <span className={styles.orderLabel}>Pedido #{ref.orderId}</span>
                      )}
                      {isClaimed && (
                        <span className={`${styles.estadoChip} ${styles.chipOk}`}>
                          <Check size={13} aria-hidden="true" /> Reclamado
                        </span>
                      )}
                      {isIneligible && (
                        <span className={`${styles.estadoChip} ${styles.chipOff}`}>
                          <AlertCircle size={13} aria-hidden="true" /> No calificó
                        </span>
                      )}
                      {restante && (
                        <span className={`${styles.estadoChip} ${styles.chipTiempo}`}>
                          <Clock size={13} aria-hidden="true" /> Quedan {restante}
                        </span>
                      )}
                      {ventanaVencida && (
                        <span className={`${styles.estadoChip} ${styles.chipOff}`}>
                          <Clock size={13} aria-hidden="true" /> Plazo vencido
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stepper */}
                  <ol className={styles.stepper}>
                    {PASOS.map((paso, i) => {
                      const n = i + 1;
                      const hecho = currentStage >= n && !(isIneligible && n === 4);
                      const esActual = currentStage === n && !isClaimed;
                      return (
                        <li
                          key={paso.key}
                          className={[
                            styles.step,
                            hecho ? styles.stepDone : '',
                            esActual ? styles.stepCurrent : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <span className={styles.stepCircle} aria-hidden="true">
                            {hecho ? <Check size={14} /> : n}
                          </span>
                          <span className={styles.stepLabel}>{paso.label}</span>
                        </li>
                      );
                    })}
                  </ol>

                  {/* Pie: qué está pasando y qué puede hacer el usuario.
                      Un solo contenedor para los tres casos (no calificó /
                      hay monedas que reclamar / todavía esperando), con el
                      texto a la izquierda y la acción a la derecha. */}
                  <div className={styles.actionBox}>
                    {isIneligible ? (
                      <p className={styles.pieNota}>
                        Esta compra no calificó para el premio de referido.
                      </p>
                    ) : canClaim || isClaimed ? (
                      <div className={styles.montos}>
                        <span className={styles.montoLinea}>
                          Compra: <strong>S/ {ref.orderTotal?.toFixed(2) || '0.00'}</strong>
                        </span>
                        <span className={styles.rewardBadge}>
                          <span className={styles.rewardLabel}>
                            {esConfirmada ? 'Ganas' : 'Ganarías'}
                          </span>
                          <span className={styles.rewardAmount}>🪙 +{gananciaMostrada}</span>
                        </span>
                      </div>
                    ) : (
                      <p className={styles.pieNota}>
                        {currentStage < 2
                          ? 'Enlace generado. Todavía nadie lo abrió — el enlace no caduca.'
                          : restante
                            ? `Ya entraron a tu enlace. Le quedan ${restante} para comprar y que cuente como tu referido.`
                            : 'Pasaron las 36 horas desde que abrió tu enlace. Si compra ahora ya no cuenta: mándale un enlace nuevo.'}
                      </p>
                    )}

                    {canClaim && (
                      <button
                        type="button"
                        className={styles.btnSolido}
                        onClick={() => handleClaim(ref)}
                        disabled={claimingId === ref.id}
                      >
                        <Coins size={16} aria-hidden="true" />
                        {claimingId === ref.id ? 'Reclamando…' : 'Reclamar monedas'}
                      </button>
                    )}

                    {/* Solo mientras nadie lo abrió: es el caso de "lo generé
                        y me olvidé de mandarlo". Una vez que alguien entró, el
                        enlace ya tiene dueño — recopiarlo y mandárselo a otra
                        persona haría que ambas compartan el mismo seguimiento
                        y solo una compra quedaría registrada. */}
                    {ref.status === 'sent' && (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => copyShareUrl(ref.id)}
                      >
                        <Copy size={15} aria-hidden="true" />
                        Copiar enlace
                      </button>
                    )}
                  </div>

                </GlassCard>
              </Reveal>
            );
          })}
        </ul>
      )}

      {/* Ranking mensual */}
      <ReferralRanking />
    </div>
  );
};

export default CuentaReferidosPage;
