/**
 * Rebobina los relojes de la Zona Arcade y de Kapi para UN usuario de prueba.
 *
 * Para qué sirve: los minijuegos están cerrados por día o por semana, así que
 * probarlos "de verdad" significaría esperar. En vez de acortar los plazos en
 * producción — que se los acortaría a TODOS los usuarios y convertiría la
 * economía en un grifo abierto — este script mueve hacia atrás las marcas de
 * tiempo del usuario que le digas. El efecto es el mismo (todo vuelve a estar
 * disponible) pero solo para esa cuenta y sin tocar una línea del código vivo.
 *
 * Credenciales: usa las de aplicación por defecto, igual que los demás scripts.
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\serviceAccountKey.json
 *
 * Uso (DRY-RUN por defecto: sin --apply no escribe nada):
 *   node scripts/rebobinar-minijuegos.js --email cliente@correo.com
 *   node scripts/rebobinar-minijuegos.js --uid AbC123 --que kapi --dias 5 --apply
 *   node scripts/rebobinar-minijuegos.js --email x@y.com --que ruleta --gracia --apply
 *
 * Flags:
 *   --uid <id> | --email <correo>   El usuario. Obligatorio uno de los dos.
 *   --que <lista>                   kapi | bolitas | wordle | ruleta | todo
 *                                   (por defecto: todo; admite "kapi,ruleta")
 *   --dias <n>                      Cuántos días atrás mover la última jugada.
 *                                   Por defecto 1 (= "ayer", vuelve a estar
 *                                   disponible hoy). Con 5 en kapi, la barra de
 *                                   felicidad se ve caer 40 puntos.
 *   --gracia                        Solo para ruleta: en vez de dejar el giro de
 *                                   esta semana, deja pendiente el de la semana
 *                                   PASADA, para probar la semana de gracia.
 *   --project <id>                  Por defecto sistema-gestion-3b225.
 *   --apply                         Escribe. Sin este flag no toca nada.
 */

const PROJECT_POR_DEFECTO = 'sistema-gestion-3b225';
const COLECCION = 'portal_clientes_users';

const { limaTodayStr, limaWeekStartStr } = require('../functions/economyLogic');

// ── Argumentos ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (nombre) => args.includes(nombre);
const valor = (nombre, porDefecto = null) => {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
};

const uid = valor('--uid');
const email = valor('--email');
const project = valor('--project', PROJECT_POR_DEFECTO);
const dias = Math.max(1, parseInt(valor('--dias', '1'), 10) || 1);
const gracia = flag('--gracia');
const apply = flag('--apply');

const QUE_VALIDOS = ['kapi', 'bolitas', 'wordle', 'ruleta'];
const queCrudo = (valor('--que', 'todo') || 'todo').toLowerCase();
const que = queCrudo === 'todo' ? QUE_VALIDOS : queCrudo.split(',').map((s) => s.trim());

const desconocidos = que.filter((q) => !QUE_VALIDOS.includes(q));
if (!uid && !email) {
  console.error('\nFalta el usuario. Pasa --uid <id> o --email <correo>.');
  console.error('Este script NUNCA actúa sobre todos los usuarios: es de uno en uno, a propósito.\n');
  process.exit(1);
}
if (desconocidos.length) {
  console.error(`\n--que no reconoce: ${desconocidos.join(', ')}`);
  console.error(`Valores válidos: ${QUE_VALIDOS.join(', ')} o "todo".\n`);
  process.exit(1);
}

// ── Fechas (mismas que usa el servidor) ──────────────────────────────────────
const DIA_MS = 24 * 60 * 60 * 1000;
const hoy = limaTodayStr();
const haceNDias = limaTodayStr(Date.now() - dias * DIA_MS);
const semanaActual = limaWeekStartStr();
const semanaAnterior = limaWeekStartStr(Date.now() - 7 * DIA_MS);

// Los 7 días de una semana, en el formato que guarda feedKapiSecure.
const sieteDiasDe = (lunes) => {
  const base = Date.parse(lunes + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => new Date(base + i * DIA_MS).toISOString().split('T')[0]);
};

// ── Firebase Admin ───────────────────────────────────────────────────────────
// firebase-admin no está en la raíz del repo, pero sí dentro de functions/. Se
// intenta primero la resolución normal y se cae a esa copia, para no obligar a
// instalar una dependencia nueva solo para lanzar un script de pruebas.
let initializeApp, applicationDefault, getFirestore, FieldValue;
const cargarAdmin = (base) => {
  ({ initializeApp, applicationDefault } = require(base + 'app'));
  ({ getFirestore, FieldValue } = require(base + 'firestore'));
};
try {
  cargarAdmin('firebase-admin/');
} catch (e) {
  try {
    // Por ruta absoluta hay que apuntar a lib/: los subcaminos "firebase-admin/app"
    // solo los resuelve el campo "exports" del package, que aquí no se aplica.
    cargarAdmin(require('path').join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin', 'lib') + require('path').sep);
  } catch (e2) {
    console.error('\nNo encuentro firebase-admin ni en la raíz ni en functions/node_modules.');
    console.error('Instálalo con:  npm i firebase-admin\n');
    process.exit(1);
  }
}

initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore();

// ── Qué escribe cada objetivo ────────────────────────────────────────────────
function construirCambios(datos) {
  const cambios = {};
  const notas = [];

  if (que.includes('kapi')) {
    cambios.lastKapiClaimDate = haceNDias;
    notas.push(`kapi     : última comida -> ${haceNDias} (hace ${dias} día(s)); vuelve a poder comer hoy`);
    if (dias > 1) {
      const caida = 10 * (dias - 1);
      const actual = Math.max(0, Math.min(100, Number(datos.kapiHappiness) || 0));
      notas.push(`           la barra pasará a mostrar ${Math.max(0, actual - caida)}/100 (cae ${caida})`);
    }
  }

  if (que.includes('bolitas')) {
    cambios.lastBallSortReward = haceNDias;
    notas.push(`bolitas  : último premio -> ${haceNDias}; vuelve a dar 2 Wala Coins hoy`);
  }

  if (que.includes('wordle')) {
    cambios.lastWordleDate = haceNDias;
    // Quien cierra el día NO es esta fecha, es el documento wordle/<uid>_<hoy>:
    // es lo que miran la pantalla del juego y la tarjeta del hub. Rebobinando
    // solo la fecha, el juego seguía apareciendo como jugado y no se podía
    // volver a probar. Se borra aparte (no es un campo del usuario), junto con
    // la marca de recompensa cobrada, o la partida nueva no pagaría monedas.
    cambios.lastWordleRewardDate = FieldValue.delete();
    notas.push(`wordle   : última partida -> ${haceNDias}; hoy vuelve a contar para racha y ranking`);
    notas.push(`           se borra la partida wordle/<uid>_${hoy} y la marca de recompensa cobrada`);
    notas.push(`           OJO: el tablero se guarda en el navegador. Borra también la clave`);
    notas.push(`           localStorage "wala_wordle_${hoy}" o no te dejará volver a jugar hoy.`);
  }

  if (que.includes('ruleta')) {
    const semana = gracia ? semanaAnterior : semanaActual;
    cambios.weeklyClaimsData = { weekStart: semana, daysClaimed: sieteDiasDe(semana) };
    cambios.ruletaDisponibleDe = semana;
    cambios.lastRuletaSpinWeek = FieldValue.delete();
    notas.push(`ruleta   : 7/7 días de la semana ${semana} y giro sin usar -> desbloqueada`);
    notas.push(gracia
      ? '           modo --gracia: el giro queda como pendiente de la semana PASADA'
      : '           (añade --gracia para probar el giro heredado de la semana anterior)');
  }

  return { cambios, notas };
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  let ref;
  if (uid) {
    ref = db.collection(COLECCION).doc(uid);
  } else {
    const snap = await db.collection(COLECCION).where('email', '==', email.trim().toLowerCase()).limit(2).get();
    if (snap.empty) {
      console.error(`\nNingún usuario con email ${email} en ${COLECCION}.\n`);
      process.exit(1);
    }
    if (snap.size > 1) {
      console.error(`\nHay más de un usuario con ese email. Usa --uid para no equivocarte.\n`);
      process.exit(1);
    }
    ref = snap.docs[0].ref;
  }

  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`\nEl usuario ${ref.id} no existe en ${COLECCION}.\n`);
    process.exit(1);
  }
  const datos = snap.data();
  const { cambios, notas } = construirCambios(datos);

  console.log('');
  console.log('  Proyecto  : ' + project);
  console.log('  Usuario   : ' + ref.id + (datos.email ? `  (${datos.email})` : ''));
  console.log('  Hoy (Lima): ' + hoy + '   |  Semana: ' + semanaActual);
  console.log('  Modo      : ' + (apply ? 'APLICAR (escribe)' : 'DRY-RUN (no escribe nada)'));
  console.log('');
  console.log('  Estado actual:');
  console.log('    lastKapiClaimDate  : ' + (datos.lastKapiClaimDate || '—'));
  console.log('    kapiHappiness      : ' + (datos.kapiHappiness ?? '—'));
  console.log('    kapiCoins          : ' + (datos.kapiCoins ?? '—'));
  console.log('    lastBallSortReward : ' + (datos.lastBallSortReward || '—'));
  console.log('    lastWordleDate     : ' + (datos.lastWordleDate || '—'));
  console.log('    lastRuletaSpinWeek : ' + (datos.lastRuletaSpinWeek || '—'));
  console.log('    ruletaDisponibleDe : ' + (datos.ruletaDisponibleDe || '—'));
  const dc = datos.weeklyClaimsData;
  console.log('    weeklyClaimsData   : ' + (dc ? `${dc.weekStart} · ${(dc.daysClaimed || []).length}/7 días` : '—'));
  console.log('');
  console.log('  Va a quedar así:');
  notas.forEach((n) => console.log('    ' + n));
  console.log('');

  if (!apply) {
    console.log('  DRY-RUN: no se ha escrito nada. Repite con --apply para aplicarlo.\n');
    return;
  }

  await ref.update(cambios);

  // La partida del día vive en su propia colección, no en el doc del usuario.
  if (que.includes('wordle')) {
    await db.collection('wordle').doc(`${ref.id}_${hoy}`).delete();
  }

  console.log('  Listo. Recarga la app con ese usuario y vuelve a jugar.\n');
})().catch((e) => {
  console.error('\nError:', e.message);
  if (String(e.message).includes('Could not load the default credentials')) {
    console.error('Define GOOGLE_APPLICATION_CREDENTIALS con la ruta al serviceAccountKey.json.\n');
  }
  process.exit(1);
});
