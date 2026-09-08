import { db } from './config';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy, limit as fsLimit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
// eslint-disable-next-line no-unused-vars
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';
import { limaWeekStartStr, limaDayOfWeek, limaTodayStr } from '../../utils/fechaLima';
import { normalizarPremio, normalizarConfig, premiosDeHoy, textoPremio, CONFIG_POR_DEFECTO } from '../../utils/ruletaModel';

// --- UTILIDADES DE FECHA ---
// El servidor (functions/economyLogic.js) trabaja siempre en hora de Lima. Estos
// helpers se mantienen exportados por compatibilidad, pero la elegibilidad usa
// los de utils/fechaLima para no desalinearse con el backend: con la hora local
// del navegador, un usuario en Europa nunca coincidía con el weekStart del
// servidor y la ruleta le quedaba bloqueada para siempre.
export const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatIsoDate = (date) => date.toISOString().split('T')[0];

export const isSameWeek = (date1, date2) => {
  return getStartOfWeek(date1).getTime() === getStartOfWeek(date2).getTime();
};

/**
 * Estado de la ruleta para este usuario.
 *
 * `reglas` viene de ruletaConfig/settings (modoDesbloqueo, semanaDeGracia). Es
 * opcional a propósito: el hub de minijuegos pinta el progreso sin cargar la
 * configuración, y con las reglas de casa el resultado es el de siempre.
 * Espeja a semanaDeGiroPendiente() en functions/index.js.
 */
export const getRuletaEligibility = (userProfile, reglas = CONFIG_POR_DEFECTO.reglas) => {
  if (!userProfile) {
    return { isUnlocked: false, days: 0, hasLost: false, hasSpun: false, esPendienteAnterior: false };
  }

  const currentWeekStart = limaWeekStartStr();
  // Semana de gracia: el giro ganado completando los 7 días sigue disponible
  // durante la semana siguiente (antes caducaba el domingo a medianoche).
  const semanaAnterior = limaWeekStartStr(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const conGracia = reglas?.semanaDeGracia !== false;

  // Analizamos los claims guardados en userProfile.weeklyClaimsData
  // Estructura: { weekStart: '2026-05-18', daysClaimed: ['2026-05-18', '2026-05-19'] }
  const data = userProfile.weeklyClaimsData || { weekStart: currentWeekStart, daysClaimed: [] };

  // daysClaimed puede faltar en perfiles antiguos; no debe reventar el hub.
  // Solo cuenta si el registro es de la semana en curso.
  const daysCount = (data.weekStart === currentWeekStart && Array.isArray(data.daysClaimed))
    ? data.daysClaimed.length
    : 0;

  // Semana cuyo premio está en juego. En modo 'siempre' (campañas) el giro se
  // ofrece cada semana sin exigir la racha; en 'racha7' hace falta completar los
  // 7 días, o que el servidor haya marcado la semana como completa.
  const semanaPremio = reglas?.modoDesbloqueo === 'siempre'
    ? currentWeekStart
    : (daysCount >= 7 ? currentWeekStart : userProfile.ruletaDisponibleDe);
  const premioVigente = !!semanaPremio &&
    (semanaPremio === currentWeekStart || (conGracia && semanaPremio === semanaAnterior));
  // El servidor marca lastRuletaSpinWeek con la semana cuyo premio se reclamó.
  const hasSpun = premioVigente && userProfile.lastRuletaSpinWeek === semanaPremio;
  const isUnlocked = premioVigente && !hasSpun;
  const esPendienteAnterior = isUnlocked && semanaPremio === semanaAnterior;

  if (data.weekStart !== currentWeekStart) {
    // La semana guardada no es la actual: 0 días esta semana, pero puede quedar
    // pendiente el giro de la semana pasada.
    return { isUnlocked, days: 0, hasLost: false, hasSpun, esPendienteAnterior };
  }
  const currentDayOfWeek = limaDayOfWeek(); // 0 (Domingo) - 6 (Sábado)

  // Para perder, debe haber pasado al menos un día en la semana sin que lo haya reclamado
  // Ej: Es miércoles (3). Debería tener 3 daysClaimed. Si tiene menos de 2, ya perdió la semana.
  // Lógica exacta de pérdida:
  let adjustedDay = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;

  // Si hoy no ha reclamado, la diferencia puede ser 1, pero aún puede reclamar hoy.
  // Si la diferencia entre el día actual de la semana y los reclamados es >= 2, seguro perdió.
  // En modo campaña no hay racha que perder.
  const hasLost = reglas?.modoDesbloqueo !== 'siempre' && (adjustedDay > daysCount + 1);

  return { isUnlocked, days: daysCount, hasLost, hasSpun, esPendienteAnterior };
};

// --- COLECCIONES ---
const PRIZES_COLLECTION = 'ruletaPrizes';
const WINS_COLLECTION = 'ruletaWins';
const CONFIG_COLLECTION = 'ruletaConfig';
const CONFIG_ID = 'settings';

// --- CONFIGURACIÓN ---
/**
 * Configuración de la ruleta (colores, reglas). El documento puede no existir
 * —nunca se llegó a escribir, la constante estaba declarada y sin usar— así que
 * normalizarConfig() devuelve siempre una configuración completa.
 */
export const getRuletaConfig = async () => {
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_ID));
    return normalizarConfig(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.error('Error fetching ruleta config:', error);
    return normalizarConfig(null);
  }
};

export const saveRuletaConfig = async (config) => {
  try {
    // merge: la configuración se guarda por pestañas (apariencia / reglas) y no
    // debe borrar lo que la otra acaba de escribir.
    await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_ID), normalizarConfig(config), { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving ruleta config:', error);
    return { success: false, error };
  }
};

// --- PREMIOS ---
/**
 * Catálogo COMPLETO de premios, normalizado (admin).
 *
 * Se ordena en memoria y no con orderBy('probability'): los premios nuevos
 * guardan `probabilidad` y una consulta ordenada por el campo viejo se dejaría
 * fuera de la lista a cualquier documento que no lo tuviera.
 */
export const getRuletaPrizes = async () => {
  try {
    const snapshot = await getDocs(collection(db, PRIZES_COLLECTION));
    return snapshot.docs
      .map((d) => normalizarPremio({ id: d.id, ...d.data() }))
      .filter(Boolean)
      .sort((a, b) => b.probabilidad - a.probabilidad);
  } catch (error) {
    console.error('Error fetching ruleta prizes:', error);
    return [];
  }
};

/**
 * Guarda un premio. Escribe el esquema nuevo Y los campos viejos
 * (name/type/probability/amount) como espejo: el cliente ya desplegado lee esos
 * campos, y sin ellos vería gajos en blanco hasta que se publique la app nueva.
 */
export const saveRuletaPrize = async (prizeData, id = null) => {
  try {
    const p = normalizarPremio({ id: id || 'nuevo', ...prizeData });
    const payload = {
      nombre: p.nombre,
      etiqueta: p.etiqueta,
      tipo: p.tipo,
      probabilidad: p.probabilidad,
      monedas: p.monedas,
      descuentoPct: p.descuentoPct,
      descuentoMonto: p.descuentoMonto,
      topeDescuento: p.topeDescuento,
      productId: p.productId,
      productName: p.productName,
      vigenciaDias: p.vigenciaDias,
      color: p.color,
      icono: p.icono,
      activo: p.activo,
      dias: p.dias,
      desde: p.desde,
      hasta: p.hasta,
      stockTotal: p.stockTotal,
      maxPorUsuario: p.maxPorUsuario,

      // Espejo para el cliente antiguo (se puede quitar cuando ya no haya
      // versiones viejas en circulación).
      name: p.nombre,
      type: p.tipo === 'monedas' ? 'Monedas' : p.tipo,
      probability: p.probabilidad,
      amount: p.monedas,
    };

    if (id) {
      // stockUsado NO se toca aquí: lo lleva el servidor con un increment y
      // sobrescribirlo desde el admin borraría las veces que ya salió.
      await updateDoc(doc(db, PRIZES_COLLECTION, id), payload);
    } else {
      await addDoc(collection(db, PRIZES_COLLECTION), { ...payload, stockUsado: 0 });
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving ruleta prize:', error);
    return { success: false, error };
  }
};

export const deleteRuletaPrize = async (id) => {
  try {
    await deleteDoc(doc(db, PRIZES_COLLECTION, id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting ruleta prize:', error);
    return { success: false, error };
  }
};

/** Reinicia el contador de veces ganado (para reabrir un premio agotado). */
export const resetStockPremio = async (id) => {
  try {
    await updateDoc(doc(db, PRIZES_COLLECTION, id), { stockUsado: 0 });
    return { success: true };
  } catch (error) {
    console.error('Error resetting ruleta prize stock:', error);
    return { success: false, error };
  }
};

// --- PREMIOS GANADOS (admin) ---
/**
 * Últimos premios ganados. Existían en `ruletaWins` desde el principio, pero no
 * había ninguna pantalla que los leyera: los premios que hay que entregar a mano
 * se quedaban ahí sin que nadie se enterara.
 */
export const getRuletaWins = async (maximo = 100) => {
  try {
    const q = query(collection(db, WINS_COLLECTION), orderBy('createdAt', 'desc'), fsLimit(maximo));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching ruleta wins:', error);
    return [];
  }
};

export const marcarPremioEntregado = async (id, entregado = true) => {
  try {
    await updateDoc(doc(db, WINS_COLLECTION, id), {
      entregado,
      entregadoAt: entregado ? new Date().toISOString() : null,
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking ruleta win as delivered:', error);
    return { success: false, error };
  }
};

// --- TABLERO Y GIRO ---
/**
 * Tablero de HOY: configuración + premios que pueden salir, tal y como los ve el
 * servidor. Es la única fuente de verdad de la rueda: si el cliente filtrara por
 * su cuenta y el servidor por la suya, la rueda pararía en un gajo que no es el
 * premio ganado.
 */
export const getRuletaBoard = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'getRuletaBoard')();
    return {
      success: true,
      config: normalizarConfig(res.data?.config),
      premios: res.data?.premios || [],
      semanaPendiente: res.data?.semanaPendiente || null,
    };
  } catch (error) {
    // Respaldo: el callable puede fallar por un arranque en frío o por estar sin
    // sesión. Las dos colecciones son de lectura pública, así que se arma el
    // tablero aquí con el MISMO filtro que usa el servidor (utils/ruletaModel es
    // un espejo generado de functions/ruletaLogic), y los gajos siguen cuadrando.
    // La única diferencia: sin perfil no se conoce `ganados`, así que un premio
    // que este usuario ya agotó por `maxPorUsuario` puede pintarse aunque el
    // servidor no vaya a dárselo.
    return await tableroDeRespaldo(error);
  }
};

const tableroDeRespaldo = async (errorOriginal) => {
  try {
    const [config, crudos] = await Promise.all([
      getRuletaConfig(),
      getDocs(collection(db, PRIZES_COLLECTION)),
    ]);
    const premios = premiosDeHoy(
      crudos.docs.map((d) => ({ id: d.id, ...d.data() })),
      { hoy: limaTodayStr(), diaSemana: limaDayOfWeek(), ganados: {} }
    );
    return {
      success: true,
      degradado: true,
      config,
      premios: premios.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        etiqueta: p.etiqueta,
        tipo: p.tipo,
        color: p.color,
        icono: p.icono,
        texto: textoPremio(p),
      })),
      semanaPendiente: null,
    };
  } catch {
    return {
      success: false,
      error: errorOriginal?.message || 'No pudimos cargar la ruleta',
      config: normalizarConfig(null),
      premios: [],
      semanaPendiente: null,
    };
  }
};

/**
 * Gira la ruleta. H-06: el sorteo (RNG) y la acreditación se hacen server-side
 * (callable spinRuletaSecure), que valida elegibilidad y que no se haya girado
 * esta semana. La firma se mantiene por compatibilidad; el servidor usa el uid
 * del token y su propio estado, no los argumentos del cliente.
 */
export const spinRuleta = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'spinRuletaSecure')();
    const bruto = res.data?.prize;
    if (!bruto) return { success: false, error: 'El servidor no devolvió ningún premio' };

    // El premio se normaliza SIEMPRE, aunque el servidor ya lo mande normalizado.
    // El front y las Cloud Functions se despliegan por separado: mientras la
    // versión vieja de spinRuletaSecure siga arriba, la respuesta llega con los
    // campos antiguos (name/type/amount) y sin `texto`. Sin esto, la pantalla de
    // resultado anunciaría el premio en blanco hasta que se desplieguen las
    // funciones. normalizarPremio entiende los dos esquemas.
    const premio = normalizarPremio(bruto);
    return {
      success: true,
      prize: { ...premio, texto: bruto.texto || textoPremio(premio) },
      cupon: res.data?.cupon || null,
    };
  } catch (error) {
    return { success: false, error: error?.message || 'Error al girar la ruleta' };
  }
};
