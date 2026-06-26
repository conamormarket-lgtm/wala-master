// =========================================================================
// Walá Design System — Vitrina / Guía de estilo viva
// -------------------------------------------------------------------------
// Una sola página (ruta /admin/design, la cablea el orquestador) que muestra
// TODO el sistema "Aurora Violeta Serena": paleta y tokens, tipografía
// Poppins, todas las variantes de los componentes ui/ (GlassButton, GlassCard,
// GlassPanel, Badge, GlassInput, GlassModal, AnimatedNumber), el movimiento
// firma (Reveal / Stagger) en acción, el fondo AuroraBackground y un mini
// gráfico de recharts con GlassTooltip y chartColors.
//
// Todo se importa desde la librería ('../../components/ui') y el tema
// ('../../theme'). No hardcodea colores que existan como token (las muestras
// de paleta usan los tokens vía variables CSS en el .module.css o como datos).
//
// Robustez: el fallback glass (@supports), el respeto a prefers-reduced-motion
// y el comportamiento táctil viven en DesignSystemPage.module.css.
// =========================================================================

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import {
  AuroraBackground,
  GlassButton,
  GlassCard,
  GlassPanel,
  GlassModal,
  GlassInput,
  Badge,
  AnimatedNumber,
  GlassTooltip,
  Reveal,
  Stagger,
  StaggerItem,
} from '../../components/ui';
import { chartColors, brand } from '../../theme';

import styles from './DesignSystemPage.module.css';

/* -------------------------------------------------------------------------
   DATOS DE LA VITRINA (estáticos, solo para demostrar las superficies)
   ------------------------------------------------------------------------- */

// Escala violeta canónica: nombre del token + su hex (de `brand.violet`).
const ESCALA_VIOLETA = [
  { nombre: '--violet-50', hex: brand.violet[50] },
  { nombre: '--violet-100', hex: brand.violet[100] },
  { nombre: '--violet-200', hex: brand.violet[200] },
  { nombre: '--violet-300', hex: brand.violet[300] },
  { nombre: '--violet-400', hex: brand.violet[400] },
  { nombre: '--violet-500', hex: brand.violet[500] },
  { nombre: '--violet-600', hex: brand.violet[600] },
  { nombre: '--violet-700', hex: brand.violet[700] },
  { nombre: '--violet-800', hex: brand.violet[800] },
  { nombre: '--violet-900', hex: brand.violet[900] },
];

// Neutros Slate de la app (espejo de variables.css; aquí solo como referencia visual).
const NEUTROS_SLATE = [
  { nombre: '--gris-texto-principal', hex: '#0F172A' },
  { nombre: '--gris-texto-secundario', hex: '#475569' },
  { nombre: '--gris-borde', hex: '#E2E8F0' },
  { nombre: '--gris-hover', hex: '#F1F5F9' },
  { nombre: '--gris-fondo', hex: '#F8FAFC' },
];

// Acentos de estado (éxito / warning / danger / dorado de fidelización).
const ESTADOS = [
  { nombre: '--verde-exito', hex: '#10B981', etiqueta: 'Éxito' },
  { nombre: '--warning', hex: '#F59E0B', etiqueta: 'Aviso' },
  { nombre: '--danger', hex: '#EF4444', etiqueta: 'Peligro' },
  { nombre: '--gold-500', hex: '#F59E0B', etiqueta: 'Walá Coins' },
];

// Gradientes de marca: nombre del token + la var CSS que pinta el fondo.
const GRADIENTES = [
  { nombre: '--gradient-brand', etiqueta: 'Marca', var: 'var(--gradient-brand)', oscuro: true },
  { nombre: '--gradient-aurora', etiqueta: 'Aurora', var: 'var(--gradient-aurora)', oscuro: false },
  { nombre: '--gradient-gold', etiqueta: 'Fidelización', var: 'var(--gradient-gold)', oscuro: true },
];

// Tonos del Badge a demostrar (cada uno se muestra en sus 3 variantes).
const TONOS_BADGE = ['neutral', 'violet', 'success', 'warning', 'danger'];
const VARIANTES_BADGE = ['solid', 'soft', 'outline'];

// Tamaños del GlassButton.
const TAMANOS_BTN = ['sm', 'md', 'lg'];

// Datos del mini-gráfico (ventas semanales de demostración, en S/).
const DATOS_GRAFICO = [
  { dia: 'Lun', ventas: 3200 },
  { dia: 'Mar', ventas: 4100 },
  { dia: 'Mié', ventas: 3800 },
  { dia: 'Jue', ventas: 5200 },
  { dia: 'Vie', ventas: 6400 },
  { dia: 'Sáb', ventas: 7100 },
  { dia: 'Dom', ventas: 4900 },
];

// Items de la grilla de movimiento (cascada de revelado).
const ITEMS_MOVIMIENTO = [
  'Entrada en cascada',
  'Curva firma expo-out',
  'Stagger de 80 ms',
  'Una sola pasada',
  'Respeta reduced-motion',
  'Sin saltos de layout',
];

/* -------------------------------------------------------------------------
   ICONOS INLINE (SVG ligeros; sin dependencias extra)
   ------------------------------------------------------------------------- */

// Icono de "rayo" para CTAs (decorativo).
const IconoRayo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 2 L3 14 h7 l-1 8 10-12 h-7 z" />
  </svg>
);

// Icono de "lupa" para inputs de búsqueda (decorativo).
const IconoLupa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// Icono de "moneda" para el sufijo del input de precio (decorativo).
const IconoMoneda = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5 a2.5 2 0 0 0 -5 0 c0 1.5 5 1.5 5 3 a2.5 2 0 0 1 -5 0" />
  </svg>
);

/* -------------------------------------------------------------------------
   SUB-COMPONENTES LOCALES DE LA VITRINA
   ------------------------------------------------------------------------- */

// Cabecera de sección reutilizable (kicker + título + descripción).
function CabeceraSeccion({ kicker, titulo, descripcion }) {
  return (
    <header className={styles.sectionHead}>
      {kicker && <span className={styles.kicker}>{kicker}</span>}
      <h2 className={styles.sectionTitle}>{titulo}</h2>
      {descripcion && <p className={styles.sectionDesc}>{descripcion}</p>}
    </header>
  );
}

// Muestra individual de color: el cuadro de color + el nombre del token + el hex.
function Swatch({ nombre, hex, etiqueta }) {
  return (
    <div className={styles.swatch}>
      <span className={styles.swatchChip} style={{ background: hex }} aria-hidden="true" />
      <span className={styles.swatchMeta}>
        {etiqueta && <strong className={styles.swatchLabel}>{etiqueta}</strong>}
        <code className={styles.swatchToken}>{nombre}</code>
        <code className={styles.swatchHex}>{hex}</code>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PÁGINA (default export)
   ------------------------------------------------------------------------- */

function DesignSystemPage() {
  // Estado del modal de demostración.
  const [modalAbierto, setModalAbierto] = useState(false);

  // Formato de soles para los contadores grandes.
  const formatoSoles = (valor) =>
    'S/ ' + Math.round(valor).toLocaleString('es-PE');
  const formatoEntero = (valor) =>
    Math.round(valor).toLocaleString('es-PE');

  return (
    <div className={styles.page}>
      {/* Fondo de marca: aurora violeta fija que acompaña el scroll. */}
      <AuroraBackground variant="violet" fixed />

      <div className={styles.container}>
        {/* =================================================================
            (1) HERO
            ================================================================= */}
        <Reveal as="section" className={styles.hero}>
          <span className={styles.kicker}>Sistema de diseño</span>
          <h1 className={styles.heroTitle}>Walá Design System</h1>
          <p className={styles.heroSubtitle}>
            «Aurora Violeta Serena»: vidrio líquido, acento violeta escaso y un
            movimiento con firma. Esta es la guía viva de cada token y cada
            componente de la interfaz de Walá.
          </p>
          <div className={styles.heroActions}>
            <GlassButton variant="primary" size="lg" icon={<IconoRayo />}>
              Explorar componentes
            </GlassButton>
            <GlassButton variant="glass" size="lg">
              Ver tokens
            </GlassButton>
          </div>
          <div className={styles.heroBadges}>
            <Badge tone="violet" variant="soft">React 18 + Vite</Badge>
            <Badge tone="success" variant="soft" dot>En vivo</Badge>
            <Badge tone="neutral" variant="outline">Mobile-first</Badge>
          </div>
        </Reveal>

        {/* =================================================================
            (2) PALETA Y TOKENS
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Fundamentos"
              titulo="Paleta y tokens"
              descripcion="La escala violeta ancla la marca; los neutros Slate dan el aire. El violeta es escaso: solo para CTAs, foco, acentos y datos."
            />
          </Reveal>

          {/* Escala violeta canónica */}
          <Reveal>
            <h3 className={styles.subheading}>Escala violeta</h3>
            <Stagger className={styles.swatchGrid}>
              {ESCALA_VIOLETA.map((c) => (
                <StaggerItem key={c.nombre}>
                  <Swatch nombre={c.nombre} hex={c.hex} />
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>

          {/* Neutros Slate */}
          <Reveal>
            <h3 className={styles.subheading}>Neutros Slate</h3>
            <Stagger className={styles.swatchGrid}>
              {NEUTROS_SLATE.map((c) => (
                <StaggerItem key={c.nombre}>
                  <Swatch nombre={c.nombre} hex={c.hex} />
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>

          {/* Estados y acentos cálidos */}
          <Reveal>
            <h3 className={styles.subheading}>Estados y acentos</h3>
            <Stagger className={styles.swatchGrid}>
              {ESTADOS.map((c) => (
                <StaggerItem key={c.nombre}>
                  <Swatch nombre={c.nombre} hex={c.hex} etiqueta={c.etiqueta} />
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>

          {/* Gradientes de marca */}
          <Reveal>
            <h3 className={styles.subheading}>Gradientes</h3>
            <Stagger className={styles.gradientGrid}>
              {GRADIENTES.map((g) => (
                <StaggerItem key={g.nombre}>
                  <div
                    className={[
                      styles.gradientCard,
                      g.oscuro ? styles.gradientCardDark : '',
                    ].filter(Boolean).join(' ')}
                    style={{ backgroundImage: g.var }}
                  >
                    <span className={styles.gradientLabel}>{g.etiqueta}</span>
                    <code className={styles.gradientToken}>{g.nombre}</code>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
        </section>

        {/* =================================================================
            (3) TIPOGRAFÍA
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Fundamentos"
              titulo="Tipografía"
              descripcion="Poppins para la interfaz; Montserrat para los títulos display. Una escala clara y legible, con jerarquía contundente."
            />
          </Reveal>
          <Reveal>
            <GlassPanel padding="lg" className={styles.typePanel}>
              <p className={styles.typeDisplay}>Aa — Display</p>
              <h1 className={styles.typeH1}>Encabezado nivel 1</h1>
              <h2 className={styles.typeH2}>Encabezado nivel 2</h2>
              <h3 className={styles.typeH3}>Encabezado nivel 3</h3>
              <p className={styles.typeBody}>
                Cuerpo de texto en Poppins. La compra debe sentirse clara y
                cálida: párrafos cómodos de leer, contraste alto y un ritmo
                sereno. «Walá» siempre con tilde y mayúscula inicial.
              </p>
              <p className={styles.typeCaption}>
                Caption / texto auxiliar para metadatos y notas al pie.
              </p>
            </GlassPanel>
          </Reveal>
        </section>

        {/* =================================================================
            (4) GLASSBUTTON — todas las variantes y tamaños
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Componentes"
              titulo="GlassButton"
              descripcion="Variantes primary / ghost / glass / danger en tres tamaños, con estados loading, disabled, fullWidth e iconos."
            />
          </Reveal>

          <Reveal>
            <GlassCard variant="solid" padding="lg">
              {/* Una fila por variante; cada fila muestra los 3 tamaños. */}
              {['primary', 'ghost', 'glass', 'danger'].map((variante) => (
                <div className={styles.btnRow} key={variante}>
                  <span className={styles.btnRowLabel}>{variante}</span>
                  <div className={styles.btnGroup}>
                    {TAMANOS_BTN.map((tam) => (
                      <GlassButton key={tam} variant={variante} size={tam}>
                        {tam.toUpperCase()}
                      </GlassButton>
                    ))}
                  </div>
                </div>
              ))}

              {/* Estados especiales */}
              <div className={styles.btnRow}>
                <span className={styles.btnRowLabel}>estados</span>
                <div className={styles.btnGroup}>
                  <GlassButton variant="primary" icon={<IconoRayo />}>
                    Con icono
                  </GlassButton>
                  <GlassButton variant="primary" loading>
                    Cargando
                  </GlassButton>
                  <GlassButton variant="primary" disabled>
                    Deshabilitado
                  </GlassButton>
                </div>
              </div>

              {/* Ancho completo */}
              <div className={styles.btnFullWrap}>
                <GlassButton variant="primary" fullWidth icon={<IconoRayo />}>
                  Botón a todo el ancho
                </GlassButton>
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* =================================================================
            (5) GLASSCARD Y GLASSPANEL — las 3 intensidades
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Componentes"
              titulo="GlassCard y GlassPanel"
              descripcion="Tres niveles de cristal: soft (90 % de los casos), solid (destacadas) e intense (modales / hero). Con header, acciones y hover."
            />
          </Reveal>

          <Stagger className={styles.cardGrid}>
            {[
              { v: 'soft', t: 'Soft', d: 'Nivel por defecto' },
              { v: 'solid', t: 'Solid', d: 'Tarjetas destacadas' },
              { v: 'intense', t: 'Intense', d: 'Modales y hero' },
            ].map((card) => (
              <StaggerItem key={card.v}>
                <GlassCard
                  variant={card.v}
                  hover
                  animate={false}
                  title={card.t}
                  subtitle={card.d}
                  actions={<Badge tone="violet" variant="soft">{card.v}</Badge>}
                >
                  <p className={styles.cardText}>
                    Superficie de vidrio líquido con desenfoque, borde de luz y
                    sombra teñida. Pasa el cursor para elevar la tarjeta y subir
                    el halo violeta.
                  </p>
                </GlassCard>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* =================================================================
            (6) BADGE — todos los tonos × variantes
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Componentes"
              titulo="Badge"
              descripcion="Etiquetas de estado en tonos neutral / violet / success / warning / danger, cada uno en variantes solid, soft y outline. Con punto opcional."
            />
          </Reveal>

          <Reveal>
            <GlassCard variant="soft" padding="lg" animate={false}>
              {VARIANTES_BADGE.map((variante) => (
                <div className={styles.badgeRow} key={variante}>
                  <span className={styles.btnRowLabel}>{variante}</span>
                  <div className={styles.badgeGroup}>
                    {TONOS_BADGE.map((tono) => (
                      <Badge key={tono} tone={tono} variant={variante}>
                        {tono}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {/* Fila con punto "en vivo" */}
              <div className={styles.badgeRow}>
                <span className={styles.btnRowLabel}>dot</span>
                <div className={styles.badgeGroup}>
                  <Badge tone="success" variant="soft" dot>En vivo</Badge>
                  <Badge tone="violet" variant="solid" dot>Nuevo</Badge>
                  <Badge tone="danger" variant="outline" dot>Agotado</Badge>
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* =================================================================
            (7) GLASSINPUT — campos de formulario
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Componentes"
              titulo="GlassInput"
              descripcion="Campos de vidrio con label, iconos, ayuda y error. Soporta input, textarea y select vía la prop as."
            />
          </Reveal>

          <Reveal>
            <GlassCard variant="solid" padding="lg" animate={false}>
              <div className={styles.formGrid}>
                <GlassInput
                  label="Nombre del producto"
                  placeholder="Polo de algodón pima"
                  hint="Así lo verán los compradores."
                />
                <GlassInput
                  label="Buscar"
                  placeholder="¿Qué buscas hoy?"
                  icon={<IconoLupa />}
                />
                <GlassInput
                  label="Precio"
                  type="number"
                  placeholder="0.00"
                  endIcon={<IconoMoneda />}
                  hint="En soles peruanos (S/)."
                />
                <GlassInput
                  label="Correo"
                  type="email"
                  defaultValue="correo-invalido"
                  error="Ingresa un correo válido."
                />
                <GlassInput
                  as="select"
                  label="Categoría"
                  defaultValue="moda"
                >
                  <option value="moda">Moda y accesorios</option>
                  <option value="hogar">Hogar y decoración</option>
                  <option value="tecnologia">Tecnología</option>
                  <option value="belleza">Belleza y cuidado</option>
                </GlassInput>
                <GlassInput
                  as="textarea"
                  label="Descripción"
                  rows={4}
                  placeholder="Cuenta la historia de tu producto…"
                  className={styles.formFull}
                />
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* =================================================================
            (8) GLASSMODAL — demo abrir / cerrar
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Componentes"
              titulo="GlassModal"
              descripcion="Diálogo de cristal profundo con foco atrapado, cierre por overlay / X / ESC y entrada animada. Pulsa para abrir."
            />
          </Reveal>

          <Reveal>
            <GlassPanel padding="lg" className={styles.modalDemo}>
              <p className={styles.cardText}>
                El modal se renderiza por portal sobre el resto de la página,
                bloquea el scroll del fondo y restaura el foco al cerrarse.
              </p>
              <GlassButton variant="primary" onClick={() => setModalAbierto(true)}>
                Abrir modal
              </GlassButton>
            </GlassPanel>
          </Reveal>

          <GlassModal
            open={modalAbierto}
            onClose={() => setModalAbierto(false)}
            title="Confirmar publicación"
            footer={
              <>
                <GlassButton variant="ghost" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </GlassButton>
                <GlassButton variant="primary" onClick={() => setModalAbierto(false)}>
                  Publicar ahora
                </GlassButton>
              </>
            }
          >
            <p className={styles.cardText}>
              Tu producto quedará visible para toda la comunidad de Walá. Podrás
              editarlo o pausarlo cuando quieras desde tu tienda.
            </p>
            <div className={styles.modalBadges}>
              <Badge tone="success" variant="soft" dot>Listo para publicar</Badge>
              <Badge tone="violet" variant="outline">Sin costo</Badge>
            </div>
          </GlassModal>
        </section>

        {/* =================================================================
            (9) ANIMATEDNUMBER — contadores
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Datos"
              titulo="AnimatedNumber"
              descripcion="Contadores que ascienden desde cero con un muelle suave al entrar en pantalla. Respetan reduced-motion (saltan al valor final)."
            />
          </Reveal>

          <Stagger className={styles.statGrid}>
            <StaggerItem>
              <GlassCard variant="solid" animate={false} className={styles.statCard}>
                <span className={styles.statLabel}>Ventas del mes</span>
                <AnimatedNumber
                  value={48250}
                  format={formatoSoles}
                  className={styles.statValue}
                />
                <Badge tone="success" variant="soft" dot>+12,4 %</Badge>
              </GlassCard>
            </StaggerItem>
            <StaggerItem>
              <GlassCard variant="solid" animate={false} className={styles.statCard}>
                <span className={styles.statLabel}>Pedidos</span>
                <AnimatedNumber
                  value={1284}
                  format={formatoEntero}
                  className={styles.statValue}
                />
                <Badge tone="violet" variant="soft">Esta semana</Badge>
              </GlassCard>
            </StaggerItem>
            <StaggerItem>
              <GlassCard variant="solid" animate={false} className={styles.statCard}>
                <span className={styles.statLabel}>Walá Coins repartidas</span>
                <AnimatedNumber
                  value={92600}
                  format={formatoEntero}
                  className={styles.statValue}
                />
                <Badge tone="warning" variant="soft">Fidelización</Badge>
              </GlassCard>
            </StaggerItem>
          </Stagger>
        </section>

        {/* =================================================================
            (10) MOVIMIENTO — Reveal / Stagger en acción
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Movimiento"
              titulo="Reveal y Stagger"
              descripcion="La firma del sistema: entrada con la curva expo-out, cascada de 80 ms y una sola pasada. Cada celda entra desfasada de la anterior."
            />
          </Reveal>

          <Stagger className={styles.motionGrid}>
            {ITEMS_MOVIMIENTO.map((texto) => (
              <StaggerItem key={texto}>
                <GlassPanel padding="md" className={styles.motionCell}>
                  {texto}
                </GlassPanel>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* =================================================================
            (11) DATOS — mini-gráfico recharts + GlassTooltip
            ================================================================= */}
        <section className={styles.section}>
          <Reveal>
            <CabeceraSeccion
              kicker="Datos"
              titulo="Gráficos"
              descripcion="recharts con la paleta del sistema (chartColors) y GlassTooltip de vidrio. Las barras alternan los acentos de marca."
            />
          </Reveal>

          <Reveal>
            <GlassCard
              variant="solid"
              padding="lg"
              animate={false}
              title="Ventas de la semana"
              subtitle="En soles (S/)"
              actions={<Badge tone="violet" variant="soft" dot>En vivo</Badge>}
            >
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={DATOS_GRAFICO}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E2E8F0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dia"
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(109, 40, 217, 0.08)' }}
                      content={<GlassTooltip suffix=" S/" />}
                    />
                    <Bar
                      dataKey="ventas"
                      name="Ventas"
                      radius={[8, 8, 0, 0]}
                      fill={chartColors[1]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* Pie de la vitrina */}
        <Reveal as="footer" className={styles.pageFooter}>
          <p>
            Walá Design System · «Aurora Violeta Serena» · Construido sobre los
            tokens de <code>src/theme</code>.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

export default DesignSystemPage;
