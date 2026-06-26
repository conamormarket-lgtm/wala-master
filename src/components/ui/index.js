/* =========================================================================
   Walá Design System — Barrel de la librería de UI
   -------------------------------------------------------------------------
   Punto único de importación de toda la familia de componentes "Aurora
   Violeta Serena". Reúne en un solo lugar las superficies de vidrio, los
   controles, los acentos y los envoltorios de movimiento, para que el resto
   de la app importe siempre así:

       import { GlassCard, GlassButton, Reveal } from '../../components/ui';

   Cada componente vive en su propio archivo con default export; aquí se
   re-exportan como NOMBRADOS. Sin lógica: solo re-exports. Este archivo
   puede escribirse aunque algún componente se cree en paralelo; las
   referencias se resuelven en tiempo de build/import.
   ========================================================================= */

/* --- Superficies de vidrio ---------------------------------------------- */
export { default as GlassCard } from './GlassCard';
export { default as GlassPanel } from './GlassPanel';
export { default as GlassModal } from './GlassModal';

/* --- Controles ---------------------------------------------------------- */
export { default as GlassButton } from './GlassButton';
export { default as GlassInput } from './GlassInput';

/* --- Acentos y datos ---------------------------------------------------- */
export { default as Badge } from './Badge';
export { default as AnimatedNumber } from './AnimatedNumber';

/* --- Fondos y atmósfera ------------------------------------------------- */
export { default as AuroraBackground } from './AuroraBackground';

/* --- Sobrecapas / ayudas ------------------------------------------------ */
export { default as GlassTooltip } from './GlassTooltip';

/* --- Envoltorios de movimiento (revelado + stagger) --------------------- */
export { default as Reveal, Stagger, StaggerItem } from './Reveal';
