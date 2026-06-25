// ── Niveles de fidelización por XP (solo cliente) ───────────────────────
// Los tiers se derivan de la XP acumulada del usuario. Es lógica de
// presentación: NO otorga beneficios server-side ni escribe en Firestore.
// El umbral de cada nivel es su XP mínima (campo `min`).
export const TIERS = [
  { key: 'bronce', name: 'Bronce', min: 0 },
  { key: 'plata', name: 'Plata', min: 100 },
  { key: 'oro', name: 'Oro', min: 300 },
  { key: 'diamante', name: 'Diamante', min: 1000 },
];

/**
 * Calcula el tier actual del usuario según su XP acumulada y el progreso
 * hacia el siguiente nivel.
 *
 * @param {number} xp - XP acumulada del usuario.
 * @returns {{
 *   current: { key: string, name: string, min: number },
 *   next: { key: string, name: string, min: number } | null,
 *   progress: number,        // 0..1 hacia el siguiente nivel (1 si es el máximo)
 *   xpInLevel: number,       // XP acumulada dentro del nivel actual
 *   xpForNext: number,       // XP total necesaria para alcanzar el siguiente nivel (0 si máximo)
 *   xpRemaining: number,     // XP que falta para el siguiente nivel (0 si máximo)
 *   isMax: boolean           // true si ya está en el nivel más alto
 * }}
 */
export function tierForXp(xp) {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;

  // El tier actual es el de mayor `min` que no supere la XP del usuario.
  let currentIndex = 0;
  for (let i = 0; i < TIERS.length; i += 1) {
    if (safeXp >= TIERS[i].min) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] || null;

  if (!next) {
    // Nivel máximo: progreso completo, no falta XP.
    return {
      current,
      next: null,
      progress: 1,
      xpInLevel: safeXp - current.min,
      xpForNext: 0,
      xpRemaining: 0,
      isMax: true,
    };
  }

  const span = next.min - current.min; // rango de XP del nivel actual
  const xpInLevel = safeXp - current.min;
  const progress = span > 0 ? Math.min(1, Math.max(0, xpInLevel / span)) : 0;

  return {
    current,
    next,
    progress,
    xpInLevel,
    xpForNext: span,
    xpRemaining: Math.max(0, next.min - safeXp),
    isMax: false,
  };
}
