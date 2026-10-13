import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Copy, Coins, MousePointerClick, ShoppingBag, Share2, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  getReferralsByReferrer,
  claimReferralCoins,
  linkInvitacion,
  VENTANA_REFERIDO_MS,
  BONO_BIENVENIDA_INVITACION,
  PREMIO_INVITACION,
} from '../../services/referrals';
import { getProduct } from '../../services/products';
import ReferralRanking from '../../components/analytics/ReferralRanking';
import { GlassCard, Reveal, Stagger, StaggerItem } from '../../components/ui';
import { IconoWala } from '../../componentes/kit/IconosWala';
import GrupoReferidos from './components/GrupoReferidos';
import styles from './CuentaReferidosPage.module.css';
import { T } from '../../i18n/useTranslatedText';

// Cada doc de `referrals` es UNA persona que abrió un link. Se agrupan por link:
//  - 'invitacion': tu link de invitación (/invitar/TU-CODIGO).
//  - 'producto:ID': el link de un producto (botón Compartir del producto).
//  - 'tienda': ?ref= sin producto (la tienda, los sorteos).
//  - 'anteriores': los links que se generaban uno por persona (sistema anterior).
const grupoDe = (r) => {
  if (r.tipo === 'invitacion') return 'invitacion';
  if (r.productId) return `producto:${r.productId}`;
  if (r.linkId || !r.tipo) return 'anteriores';
  return 'tienda';
};

const ms = (t) => t?.toMillis?.() || 0;
const actividad = (r) => Math.max(ms(r.claimedAt), ms(r.purchasedAt), ms(r.aceptadaAt), ms(r.clickedAt), ms(r.createdAt));

const CuentaReferidosPage = () => {
  const { userProfile } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState(null);
  const [detallesAbiertos, setDetallesAbiertos] = useState({});
  const [ahora, setAhora] = useState(() => Date.now());

  const referralCode = userProfile?.referralCode || '';
  const miLink = referralCode ? linkInvitacion(referralCode) : '';

  const { data: referrals, isLoading } = useQuery({
    queryKey: ['myReferrals', referralCode],
    queryFn: async () => {
      const res = await getReferralsByReferrer(referralCode);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: !!referralCode,
  });

  // Personas = los que abrieron algún link. Los links del sistema anterior que
  // nadie abrió ('sent') no son personas: solo se cuentan.
  const personas = useMemo(() => (referrals || []).filter((r) => r.status !== 'sent'), [referrals]);
  const sinAbrir = (referrals || []).length - personas.length;

  const grupos = useMemo(() => {
    const mapa = new Map();
    personas.forEach((r) => {
      const k = grupoDe(r);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(r);
    });
    mapa.forEach((lista) => lista.sort((a, b) => actividad(b) - actividad(a)));
    return mapa;
  }, [personas]);

  // Nombre y foto de cada producto compartido (catálogo público).
  const productIds = useMemo(
    () => [...grupos.keys()].filter((k) => k.startsWith('producto:')).map((k) => k.slice(9)).sort(),
    [grupos]
  );
  const { data: productos } = useQuery({
    queryKey: ['referidosProductos', productIds],
    queryFn: async () => {
      const pares = await Promise.all(productIds.map(async (id) => [id, (await getProduct(id)).data || null]));
      return Object.fromEntries(pares);
    },
    enabled: productIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Avisos al entrar: lo que pasó con tus links en los últimos 3 días.
  useEffect(() => {
    if (!personas.length) return;
    const clave = 'notified_referrals_' + referralCode;
    let avisados = [];
    try { avisados = JSON.parse(localStorage.getItem(clave) || '[]'); } catch { /* vacío */ }
    const nuevos = [];
    personas
      .filter((r) => Date.now() - actividad(r) <= 3 * 24 * 60 * 60 * 1000)
      .forEach((r) => {
        const marca = `${r.id}_${r.status}`;
        if (avisados.includes(marca)) return;
        const quien = r.visitanteNombre || 'Alguien';
        if (r.status === 'clicked') toast.info(`${quien} entró a tu link.`);
        else if (r.status === 'registered') toast.success(`${quien} creó su cuenta con tu invitación.`);
        else if (r.status === 'purchased') toast.success(`¡${quien} compró con tu link!`);
        nuevos.push(marca);
      });
    if (nuevos.length) {
      try { localStorage.setItem(clave, JSON.stringify([...avisados, ...nuevos].slice(-300))); } catch { /* lleno */ }
    }
  }, [personas, referralCode, toast]);

  // Reloj vivo solo mientras alguien tenga un plazo de 36 h corriendo.
  const hayCuentaRegresiva = personas.some(
    (r) => r.status === 'clicked' && ms(r.clickedAt) + VENTANA_REFERIDO_MS > ahora
  );
  useEffect(() => {
    if (!hayCuentaRegresiva) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hayCuentaRegresiva]);

  const copiar = (texto, ok) =>
    navigator.clipboard.writeText(texto)
      .then(() => toast.success(ok))
      .catch(() => toast.error('No se pudo copiar'));

  const compartirInvitacion = async () => {
    const texto = `Te invito a Walá: crea tu cuenta con mi link y recibe ${BONO_BIENVENIDA_INVITACION} monedas para tu primera compra.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Walá', text: texto, url: miLink }); return; } catch { /* cancelado */ }
    }
    copiar(`${texto} ${miLink}`, '¡Mensaje con tu link copiado!');
  };

  const handleClaim = async (r) => {
    // El monto real (y si ya se puede) lo decide claimReferralSecure contra el
    // ERP: el pedido tiene que haber salido de ese link y estar entregado.
    setClaimingId(r.id);
    const { earned, error } = await claimReferralCoins(r.id);
    setClaimingId(null);
    if (error) {
      toast.error(error || 'Error al reclamar monedas');
      // Se abre el pedido para que vea en qué etapa va.
      setDetallesAbiertos((prev) => ({ ...prev, [r.id]: true }));
      return;
    }
    toast.success(`¡Has reclamado ${earned ?? ''} monedas con éxito!`);
    queryClient.invalidateQueries({ queryKey: ['myReferrals', referralCode] });
    queryClient.invalidateQueries({ queryKey: ['referralOrder', r.id] });
  };

  const toggleDetalle = (id) => setDetallesAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));

  // Marcadores
  const totalCompras = personas.filter((r) => ['purchased', 'completed', 'claimed'].includes(r.status)).length;
  const porReclamar = personas.filter((r) => ['purchased', 'completed'].includes(r.status)).length;
  const totalMonedas = personas.reduce((acc, r) => acc + (r.status === 'claimed' ? r.earnedCoins || 0 : 0), 0);
  const cuentasNuevas = personas.filter((r) => r.invitadoUid).length;

  const comunes = { ahora, detallesAbiertos, onToggleDetalle: toggleDetalle, onClaim: handleClaim, claimingId };
  const otrosGrupos = [...grupos.entries()]
    .filter(([k]) => k !== 'invitacion')
    .sort(([, a], [, b]) => actividad(b[0]) - actividad(a[0]));

  return (
    <div className={styles.page}>
      {/* ── Cabecera: las dos formas de ganar ────────────────────────────── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <Users size={20} aria-hidden="true" />
            </div>
            <h2>Invita y gana monedas</h2>
          </div>
          <p className={styles.headerSub}>
            Hay dos formas. Cada moneda vale S/&nbsp;1 de descuento, y las ganas cuando el pedido se entrega.
          </p>

          <div className={styles.formas}>
            <div className={styles.forma}>
              <IconoWala nombre="regalo" tamano={40} />
              <div>
                <p className={styles.pasoTitle}>Invita a alguien nuevo</p>
                <p className={styles.pasoText}>
                  Con tu link de invitación crea su cuenta y recibe <strong>{BONO_BIENVENIDA_INVITACION} monedas</strong>.
                  Con su primera compra (tiene 30 días) tú ganas <strong>{PREMIO_INVITACION} monedas</strong>, o
                  el 5&nbsp;% / 10&nbsp;% si es más.
                </p>
              </div>
            </div>
            <div className={styles.forma}>
              <IconoWala nombre="polera" tamano={40} />
              <div>
                <p className={styles.pasoTitle}>Comparte un producto</p>
                <p className={styles.pasoText}>
                  Cualquiera que compre dentro de las 36&nbsp;h desde que abre tu link te suma el{' '}
                  <strong>5&nbsp;%</strong> de su compra, o el <strong>10&nbsp;%</strong> si supera los S/&nbsp;200.
                </p>
              </div>
            </div>
          </div>
          <p className={styles.codeNote}>
            Cada persona que entra cuenta aparte: puedes mandar el mismo link a un grupo o ponerlo en tu estado.
            Si alguien abrió varios links, cuenta el último. Quien lo abra verá tu primer nombre.
          </p>
        </GlassCard>
      </Reveal>

      {/* ── Tu link de invitación ────────────────────────────────────────── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <p className={styles.codeLabel}>Tu link de invitación</p>
          <div className={styles.codeRow}>
            <span className={styles.linkText}>{miLink || '—'}</span>
          </div>
          <div className={styles.generateRow}>
            <button
              type="button"
              className={`${styles.btnSolido} ${styles.btnGenerate}`}
              onClick={compartirInvitacion}
              disabled={!referralCode}
            >
              <Share2 size={17} aria-hidden="true" />
              Compartir invitación
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => copiar(miLink, '¡Link copiado!')}
              disabled={!referralCode}
            >
              <Copy size={15} aria-hidden="true" />
              Copiar link
            </button>
            <p className={styles.generateHint}>
              No caduca y es siempre el mismo. Si quien lo abre ya tiene cuenta, igual te suma si compra en 36&nbsp;h.
            </p>
          </div>
          <div className={styles.generateRow}>
            <p className={styles.generateHint}>
              Para un producto: ábrelo en la <Link to="/tienda">tienda</Link> y toca el botón de compartir.
              Tu código es <strong>{referralCode || '—'}</strong>.
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
            <span className={styles.statLabel}>Personas que entraron</span>
            <span className={styles.statValue}>{personas.length}</span>
            <span className={styles.statHint}>
              {cuentasNuevas > 0
                ? `${cuentasNuevas} ${cuentasNuevas === 1 ? 'creó su cuenta' : 'crearon su cuenta'} con tu invitación`
                : 'Por cualquiera de tus links.'}
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
              {porReclamar > 0 ? `${porReclamar} por reclamar` : 'Compras hechas con tus links.'}
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
            <span className={styles.statHint}>Saldo actual: {userProfile?.monedas || 0}</span>
          </GlassCard>
        </StaggerItem>
      </Stagger>

      {/* ── Quiénes entraron, por link ───────────────────────────────────── */}
      <div className={styles.listHead}>
        <h3 className={styles.listTitle}><T>Quiénes entraron a tus links</T></h3>
        {!isLoading && personas.length > 0 && (
          <span className={styles.listCount}>
            {personas.length} {personas.length === 1 ? 'persona' : 'personas'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className={styles.skeletonList} aria-hidden="true">
          {[1, 2].map((n) => <div key={n} className={styles.skeletonItem} />)}
        </div>
      ) : (
        <div className={styles.grupos}>
          <GrupoReferidos
            {...comunes}
            titulo="Tu invitación"
            icono="regalo"
            personas={grupos.get('invitacion') || []}
          />

          {otrosGrupos.map(([clave, lista]) => {
            const productId = clave.startsWith('producto:') ? clave.slice(9) : null;
            const producto = productId ? productos?.[productId] : null;
            const titulo = productId
              ? (producto?.name || 'Producto compartido')
              : clave === 'tienda' ? 'Links a la tienda y sorteos' : 'Links anteriores';
            return (
              <GrupoReferidos
                key={clave}
                {...comunes}
                titulo={titulo}
                antetitulo={productId ? 'Link del producto' : null}
                icono={productId ? 'polera' : 'destello'}
                imagen={producto?.mainImage || producto?.images?.[0] || null}
                descripcion={productId
                  ? 'Cuenta cualquier compra que hagan en 36 h, no solo este producto.'
                  : clave === 'anteriores' ? 'Los links que se generaban uno por persona. Siguen funcionando.' : null}
                personas={lista}
                extra={clave === 'anteriores' && sinAbrir > 0
                  ? <p className={styles.pieNota}>{sinAbrir} {sinAbrir === 1 ? 'link generado sigue' : 'links generados siguen'} sin abrir.</p>
                  : null}
              />
            );
          })}

          {otrosGrupos.length === 0 && (
            <GlassCard variant="solid" padding="lg" animate={false} className={styles.empty} bodyClassName={styles.emptyBody}>
              <div className={styles.emptyIcon}>
                <Send size={26} aria-hidden="true" />
              </div>
              <p className={styles.emptyTitle}>Todavía no compartiste productos.</p>
              <p className={styles.emptyText}>
                Abre un producto en la tienda y toca compartir: aquí verás quién entró y quién compró.
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Ranking mensual */}
      <ReferralRanking />
    </div>
  );
};

export default CuentaReferidosPage;
