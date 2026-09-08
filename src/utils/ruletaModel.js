// =========================================================================
// Ruleta Semanal — modelo de premios y disponibilidad (ESPEJO DE CLIENTE)
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-espejo-ruleta.js desde functions/ruletaLogic.js.
// No lo edites a mano: edita el original y vuelve a ejecutar el script. El
// servidor sortea y el cliente pinta la rueda; si los dos no filtran y ordenan
// igual, la rueda para en un gajo que no es el premio ganado.
// =========================================================================

// ── Tipos de premio ───────────────────────────────────────────────────────
// monedas            -> se acredita solo (única entrega automática histórica).
// descuento          -> cupón de % o monto fijo sobre el total del pedido.
// producto_descuento -> cupón de % sobre un producto concreto.
// producto_gratis    -> cupón que regala una unidad de un producto concreto.
// envio_gratis       -> cupón que anula el costo de envío.
// manual             -> se entrega a mano (queda en ruletaWins para el admin).
// nada               -> gajo de relleno ("sigue intentando"), sin premio.
export const TIPOS_PREMIO = [
  "monedas",
  "descuento",
  "producto_descuento",
  "producto_gratis",
  "envio_gratis",
  "manual",
  "nada",
];

// Los premios creados con el primer admin guardaban el tipo capitalizado. Se
// siguen leyendo tal cual: no hay migración que correr.
export const TIPOS_LEGADO = {
  Monedas: "monedas",
  Descuento: "descuento",
  Producto: "producto_gratis",
  Beneficio: "envio_gratis",
  // No existe un inventario de accesorios de mascota en el que depositarlo, así
  // que se trata como entrega manual en vez de fingir que se acredita.
  Accesorio: "manual",
};

// Tipos que generan un cupón en userCoupons.
export const TIPOS_CON_CUPON = [
  "descuento",
  "producto_descuento",
  "producto_gratis",
  "envio_gratis",
];

export const VIGENCIA_CUPON_POR_DEFECTO = 30; // días

// ── Normalización ─────────────────────────────────────────────────────────
// Acepta el esquema nuevo y el viejo (name/type/probability/amount) y devuelve
// siempre la misma forma. Todo lector debe pasar por aquí.
export function normalizarPremio(raw) {
  if (!raw || typeof raw !== "object") return null;

  const tipoCrudo = raw.tipo || raw.type || "";
  const tipo = TIPOS_PREMIO.includes(tipoCrudo)
    ? tipoCrudo
    : (TIPOS_LEGADO[tipoCrudo] || "nada");

  const nombre = String(raw.nombre || raw.name || "").trim();
  const probabilidad = Math.max(0, Number(raw.probabilidad ?? raw.probability ?? 0) || 0);

  // dias: dias de la semana (0=domingo .. 6=sabado) en que el premio puede
  // salir. Vacío o ausente = todos los días (los premios viejos no lo tienen).
  const diasCrudos = Array.isArray(raw.dias) ? raw.dias : null;
  // Ojo con Number(null) === 0: una entrada basura se convertiría en "domingo" y
  // el premio saldría un día que nadie configuró. Se descarta lo que no sea un
  // número (o una cadena numérica) ANTES de convertir.
  const dias = diasCrudos
    ? diasCrudos
      .filter((d) => (typeof d === "number" || typeof d === "string") && String(d).trim() !== "")
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];

  return {
    id: raw.id,
    nombre,
    // Lo que se pinta dentro del gajo. Si no se define, se recorta el nombre:
    // un nombre largo se salía del disco y quedaba cortado a la mitad.
    etiqueta: String(raw.etiqueta || nombre).trim(),
    tipo,
    probabilidad,

    // Carga útil por tipo.
    monedas: Math.max(0, Number(raw.monedas ?? raw.amount ?? 0) || 0),
    descuentoPct: Math.max(0, Math.min(100, Number(raw.descuentoPct || 0) || 0)),
    descuentoMonto: Math.max(0, Number(raw.descuentoMonto || 0) || 0),
    // Techo en soles para los descuentos por porcentaje. El subtotal del carrito
    // lo calcula el cliente (los productos personalizados tienen un precio que
    // no está en el catálogo), así que un 20% sin tope es un cheque en blanco:
    // esto acota cuánto puede llegar a descontar un cupón. 0 = sin tope.
    topeDescuento: Math.max(0, Number(raw.topeDescuento || 0) || 0),
    productId: raw.productId ? String(raw.productId) : null,
    productName: raw.productName ? String(raw.productName) : "",
    vigenciaDias: Math.max(1, Number(raw.vigenciaDias || VIGENCIA_CUPON_POR_DEFECTO) || VIGENCIA_CUPON_POR_DEFECTO),

    // Presentación. color null = toma el color que le toque de la paleta.
    color: raw.color || null,
    icono: raw.icono || "",

    // Disponibilidad.
    activo: raw.activo !== false, // los premios viejos no lo traen: activos.
    dias,
    desde: raw.desde || null,
    hasta: raw.hasta || null,
    stockTotal: Number.isFinite(Number(raw.stockTotal)) && Number(raw.stockTotal) > 0
      ? Number(raw.stockTotal)
      : null, // null = ilimitado
    stockUsado: Math.max(0, Number(raw.stockUsado || 0) || 0),
    maxPorUsuario: Number.isFinite(Number(raw.maxPorUsuario)) && Number(raw.maxPorUsuario) > 0
      ? Number(raw.maxPorUsuario)
      : null, // null = sin tope
  };
}

// ── Disponibilidad ────────────────────────────────────────────────────────
// ¿Puede salir HOY este premio? `ctx` = { hoy: 'YYYY-MM-DD' (Lima),
// diaSemana: 0-6 (Lima), ganados: { [prizeId]: n } del usuario }.
export function premioDisponible(premio, ctx) {
  if (!premio) return false;
  if (!premio.activo) return false;
  if (premio.probabilidad <= 0) return false;

  // Días de la semana (lista vacía = todos).
  if (premio.dias.length > 0 && !premio.dias.includes(ctx.diaSemana)) return false;

  // Ventana de campaña (comparación de cadenas 'YYYY-MM-DD': ordenan igual).
  if (premio.desde && ctx.hoy < premio.desde) return false;
  if (premio.hasta && ctx.hoy > premio.hasta) return false;

  // Stock global.
  if (premio.stockTotal !== null && premio.stockUsado >= premio.stockTotal) return false;

  // Tope por usuario.
  if (premio.maxPorUsuario !== null) {
    const ganados = Number((ctx.ganados || {})[premio.id] || 0);
    if (ganados >= premio.maxPorUsuario) return false;
  }

  return true;
}

// Lista de premios que se pintan en la rueda HOY, en orden estable (el orden
// del gajo debe ser idéntico en cliente y servidor: se ordena por id).
export function premiosDeHoy(premiosCrudos, ctx) {
  return (premiosCrudos || [])
    .map(normalizarPremio)
    .filter((p) => p && premioDisponible(p, ctx))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// ── Configuración de la ruleta (ruletaConfig/settings) ────────────────────
// Paletas de la rueda. Los colores se reparten entre los gajos ciclándolos; si
// el número de gajos es impar, se rota el arranque para que el primero y el
// último no queden del mismo color (la rueda vieja, con dos violetas fijos,
// mostraba dos gajos pegados idénticos siempre que había premios impares).
export const PRESETS_TEMA = {
  aurora: {
    nombre: "Aurora Violeta",
    colores: ["#6D28D9", "#A78BFA", "#5B21B6", "#8B5CF6"],
    colorAro: "#FFFFFF",
    colorPuntero: "#6D28D9",
  },
  caramelo: {
    nombre: "Caramelo",
    colores: ["#F472B6", "#FB923C", "#FACC15", "#34D399"],
    colorAro: "#FFFFFF",
    colorPuntero: "#F472B6",
  },
  oro: {
    nombre: "Oro",
    colores: ["#B45309", "#F59E0B", "#FCD34D", "#78350F"],
    colorAro: "#FFF7ED",
    colorPuntero: "#B45309",
  },
  oceano: {
    nombre: "Océano",
    colores: ["#0E7490", "#38BDF8", "#155E75", "#06B6D4"],
    colorAro: "#FFFFFF",
    colorPuntero: "#0E7490",
  },
};

export const CONFIG_POR_DEFECTO = {
  activa: true,
  tema: {
    preset: "aurora",
    colores: PRESETS_TEMA.aurora.colores,
    colorAro: PRESETS_TEMA.aurora.colorAro,
    colorPuntero: PRESETS_TEMA.aurora.colorPuntero,
    imagenCentro: "",
  },
  reglas: {
    // racha7  -> hay que reclamar los 7 días (regla histórica).
    // siempre -> un giro por semana sin condición (para campañas).
    modoDesbloqueo: "racha7",
    semanaDeGracia: true,
    vueltas: 6,
    duracionGiroMs: 4500,
  },
};

export const MODOS_DESBLOQUEO = ["racha7", "siempre"];

// Devuelve siempre una config completa: el doc puede no existir (nunca se creó:
// CONFIG_DOC estaba declarado pero jamás se escribía) o venir a medias.
export function normalizarConfig(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const tema = base.tema && typeof base.tema === "object" ? base.tema : {};
  const reglas = base.reglas && typeof base.reglas === "object" ? base.reglas : {};

  // Sin preset guardado es una config que aún no se ha tocado: vale la de casa.
  // Solo se considera "personalizado" si hay un preset escrito que no conocemos.
  const preset = tema.preset
    ? (PRESETS_TEMA[tema.preset] ? tema.preset : "personalizado")
    : "aurora";
  const coloresCrudos = Array.isArray(tema.colores)
    ? tema.colores.filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c))
    : [];
  const colores = coloresCrudos.length > 0
    ? coloresCrudos.slice(0, 8)
    : (PRESETS_TEMA[preset] || PRESETS_TEMA.aurora).colores;

  const modo = MODOS_DESBLOQUEO.includes(reglas.modoDesbloqueo)
    ? reglas.modoDesbloqueo
    : CONFIG_POR_DEFECTO.reglas.modoDesbloqueo;

  return {
    activa: base.activa !== false,
    tema: {
      preset,
      colores,
      colorAro: tema.colorAro || CONFIG_POR_DEFECTO.tema.colorAro,
      colorPuntero: tema.colorPuntero || colores[0],
      imagenCentro: tema.imagenCentro || "",
    },
    reglas: {
      modoDesbloqueo: modo,
      semanaDeGracia: reglas.semanaDeGracia !== false,
      // Acotados: una rueda con 40 vueltas o 30 segundos de giro no es una
      // configuración, es una pantalla colgada.
      vueltas: Math.max(2, Math.min(12, Number(reglas.vueltas) || CONFIG_POR_DEFECTO.reglas.vueltas)),
      duracionGiroMs: Math.max(1500, Math.min(10000,
        Number(reglas.duracionGiroMs) || CONFIG_POR_DEFECTO.reglas.duracionGiroMs)),
    },
  };
}

// Color del gajo i: el propio del premio si lo tiene, si no el de la paleta.
export function colorDeGajo(premio, indice, total, colores) {
  if (premio && premio.color) return premio.color;
  const paleta = Array.isArray(colores) && colores.length > 0 ? colores : PRESETS_TEMA.aurora.colores;
  // El primer y el último gajo son vecinos en la rueda. Chocan solo cuando al
  // último le toca el color 0, es decir cuando (total - 1) es múltiplo de la
  // paleta; entonces se le corre uno. La condición de antes era `total % n !== 0`,
  // que se disparaba casi siempre: con 2 gajos y 4 colores saltaba del color 1 al
  // 2 sin necesidad, y los dos gajos salían del mismo violeta oscuro.
  const n = paleta.length;
  if (total > 1 && indice === total - 1 && (total - 1) % n === 0) {
    return paleta[(indice + 1) % n];
  }
  return paleta[indice % n];
}

// ── Sorteo ────────────────────────────────────────────────────────────────
// Reparte por peso sobre los premios YA filtrados. Las probabilidades que pone
// el admin suman 100 sobre el catálogo completo, pero la rueda de hoy puede ser
// un subconjunto (premios de fin de semana, agotados, topados por usuario), así
// que se renormaliza sobre lo que queda. Sin esto, con un catálogo filtrado al
// 60% el 40% restante caía siempre en el último premio por el fallback.
// `aleatorio` es un número en [0,1): inyectable para poder testearlo.
export function sortearPremio(premios, aleatorio) {
  if (!Array.isArray(premios) || premios.length === 0) return null;
  const total = premios.reduce((s, p) => s + (Number(p.probabilidad) || 0), 0);
  if (total <= 0) return premios[0];
  const r = Math.min(Math.max(Number(aleatorio) || 0, 0), 0.9999999);
  const objetivo = r * total;
  let acc = 0;
  for (const p of premios) {
    acc += Number(p.probabilidad) || 0;
    if (objetivo < acc) return p;
  }
  return premios[premios.length - 1];
}

// Suma de probabilidades del catálogo (el admin la usa para avisar si no da 100).
export function sumaProbabilidades(premios) {
  return (premios || []).reduce((s, p) => s + (Number(p.probabilidad ?? p.probability) || 0), 0);
}

// ¿Este tipo de premio se entrega como cupón en userCoupons?
export function esCupon(tipo) {
  return TIPOS_CON_CUPON.includes(tipo);
}

// Texto corto de lo que se gana. Se usa en el modal del cliente, en la tabla del
// admin y como título del cupón, para que los tres digan lo mismo.
export function textoPremio(premio) {
  if (!premio) return "";
  switch (premio.tipo) {
    case "monedas":
      return premio.monedas + " monedas";
    case "descuento":
      if (premio.descuentoPct > 0) {
        return premio.descuentoPct + "% de descuento" +
          (premio.topeDescuento > 0 ? " (hasta S/ " + premio.topeDescuento.toFixed(2) + ")" : "");
      }
      return "S/ " + premio.descuentoMonto.toFixed(2) + " de descuento";
    case "producto_descuento":
      return premio.descuentoPct + "% en " + (premio.productName || "un producto");
    case "producto_gratis":
      return (premio.productName || "Un producto") + " gratis";
    case "envio_gratis":
      return "Envío gratis";
    case "manual":
      return premio.nombre;
    case "nada":
    default:
      return premio.nombre || "Sigue intentando";
  }
}

// ── Ángulo de parada de la rueda ──────────────────────────────────────────
// Cuánto hay que girar el disco para que el gajo `indice` quede bajo el puntero
// (que está arriba, a las 12). Los gajos se dibujan en sentido horario desde las
// 12, así que el gajo i está centrado en (i + 0,5) * ángulo y hay que girar el
// disco en sentido contrario esa misma cantidad, más las vueltas de adorno.
//
// Vive aquí, y no dentro de la pantalla, porque es el punto donde un error de
// medio gajo hace que la rueda pare visualmente en un premio distinto del que
// anuncia el servidor, y eso no se ve en una revisión a ojo.
export function anguloDeParada(indice, total, vueltas) {
  if (!Number.isInteger(indice) || indice < 0 || !total || total < 1) return 0;
  const anguloGajo = 360 / total;
  const giros = Math.max(0, Number(vueltas) || 0);
  return 360 * giros + (360 - indice * anguloGajo) - anguloGajo / 2;
}
