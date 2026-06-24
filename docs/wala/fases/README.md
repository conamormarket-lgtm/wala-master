# Fases del proyecto WALA — Índice

Esta carpeta documenta cada **fase del roadmap** de WALA por separado. El roadmap completo y
su justificación viven en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md); el estado general y la
cronología del trabajo, en [ESTADO-DEL-PROYECTO.md](../ESTADO-DEL-PROYECTO.md).

> **Leyenda de estado:**
> ✅ **HECHO** — implementado y verificado (en local; nada desplegado aún).
> 🔧 **EN PROGRESO** — parcialmente implementado.
> ⬜ **POR HACER** — planificado, sin código aún.

---

## Tabla de fases

| Fase | Documento | Estado | En una línea |
|------|-----------|--------|--------------|
| **0 — Estabilización y seguridad** | [FASE-0-SEGURIDAD.md](../FASE-0-SEGURIDAD.md) | ✅ HECHO (parcial) | Eliminar backdoor admin, reglas reales, economía server-authoritative; 11 hallazgos H-01..H-11 (commits `3d53501`, `9e84990`, `f0e4aa0`). |
| **1 — Plataforma y datos base** | _(en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md))_ | 🔧 EN PROGRESO | Migración CRA→Vite, `vendorId`/`nicheId`/`fulfillmentType` aditivos, búsqueda y rutas (commits `a3c4d66`, `a652f60`, `f188260`, `0f2414f`). |
| **2 — Fidelización unificada** | _(en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md))_ | ⬜ POR HACER | Economía única sobre `loyaltyLedger`, misiones diarias, racha global, tiers/XP, push v2. |
| **3 — Marketplace multi-vendor** | _(en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md))_ | ⬜ POR HACER | Entidad `vendors` + rol vendedor + panel, `order`/`subOrders`, split de pago, payouts, envíos por zona. |
| **4 — Personalizados como nicho POD** | _(en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md))_ | ⬜ POR HACER | Arte de producción real (DPI/PDF), `blueprints` reutilizables, consolidar editores. |
| **5 — Impulso, FOMO e inteligencia** | _(en [PLAN-MAESTRO.md §6](../PLAN-MAESTRO.md))_ | ⬜ POR HACER | Ruleta diaria + cofres, segmentación RFM, campañas programables, antifraude completo. |

> Nota: por ahora solo la **Fase 0** tiene documento dedicado
> ([FASE-0-SEGURIDAD.md](../FASE-0-SEGURIDAD.md)). Las fases 1–5 están descritas en el plan
> maestro; cuando cada una arranque se creará su `FASE-N-*.md` en esta carpeta y se enlazará
> aquí.

---

## Flujo de lectura recomendado

1. **[ESTADO-DEL-PROYECTO.md](../ESTADO-DEL-PROYECTO.md)** — para entender dónde estamos hoy
   y qué se ha hecho.
2. **[PLAN-MAESTRO.md](../PLAN-MAESTRO.md)** — para el roadmap completo (fases 0–5) y el
   porqué de cada decisión.
3. **[FASE-0-SEGURIDAD.md](../FASE-0-SEGURIDAD.md)** — el detalle de la fase ya ejecutada
   (hallazgos H-01..H-11 y su estado de cierre).
4. **[MODELO-DATOS.md](../MODELO-DATOS.md)** — antes de tocar datos o reglas en cualquier fase.
5. **[DESPLIEGUE.md](../DESPLIEGUE.md)** + `ops/` — cuando llegue el momento de desplegar una
   fase a staging/producción.
