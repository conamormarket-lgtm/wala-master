/**
 * Creación automática de cuentas de usuario desde datos de pedidos/ventas del ERP.
 * Una sola cuenta por email; contraseña inicial = DNI (mínimo 6 caracteres por política Firebase).
 */
import {
  createUserWithEmailAndPassword,
  updateProfile,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { auth, getFirebaseConfigMessage } from './firebase/config';
import { deleteDocument, getDocument, setDocument } from './firebase/firestore';
import { updateOrderInERP } from './erp/firebase';
import { getPedidosForAccountSync } from './erp/firebase';
import { LEGACY_USERS_COLLECTION, PORTAL_USERS_COLLECTION } from '../constants/userCollections';

const MIN_PASSWORD_LENGTH = 6;

const ERP_NOMBRE = [
  'clienteNombre',
  'clienteApellidos',
  'clienteNombreCompleto',
  'nombreCompleto',
  'customerName',
  'nombreCliente',
  'nombre',
];
const ERP_CORREO = ['clienteCorreo', 'correo', 'email', 'correoElectronico'];
const ERP_TELEFONO1 = ['clienteContacto', 'telefono1', 'numero1', 'phone', 'telefono', 'phone1'];

function getFirst(pedido, keys) {
  if (!pedido || typeof pedido !== 'object') return undefined;
  for (const k of keys) {
    if (pedido[k] != null && pedido[k] !== '') return pedido[k];
  }
  return undefined;
}

/**
 * Extrae datos de cliente desde un pedido raw del ERP para crear perfil de usuario.
 * @param {Object} pedidoRaw - Documento de pedido (con id si existe)
 * @returns {{ email: string | null, displayName: string | null, dni: string | null, phone: string | null, tipoDocumento: string | null }}
 */
export function extraerDatosClienteDesdePedido(pedidoRaw) {
  if (!pedidoRaw || typeof pedidoRaw !== 'object') {
    return { email: null, displayName: null, dni: null, phone: null, tipoDocumento: null };
  }
  const nombrePartes = [
    pedidoRaw.clienteNombre,
    pedidoRaw.clienteApellidos,
  ].filter(Boolean);
  const displayName =
    nombrePartes.length > 0
      ? nombrePartes.join(' ')
      : getFirst(pedidoRaw, ERP_NOMBRE) || null;
  const emailRaw = getFirst(pedidoRaw, ERP_CORREO);
  const email =
    typeof emailRaw === 'string' && emailRaw.trim()
      ? emailRaw.trim().toLowerCase()
      : null;
  const dniRaw = pedidoRaw.clienteNumeroDocumento ?? pedidoRaw.dni ?? pedidoRaw.documento;
  const dni =
    dniRaw != null && String(dniRaw).trim()
      ? String(dniRaw).trim().replace(/\s/g, '')
      : null;
  const phoneRaw = getFirst(pedidoRaw, ERP_TELEFONO1);
  const phone =
    phoneRaw != null && String(phoneRaw).trim()
      ? String(phoneRaw).replace(/\D/g, '')
      : null;
  const tipoDocumento =
    pedidoRaw.tipoDocumento != null && String(pedidoRaw.tipoDocumento).trim()
      ? String(pedidoRaw.tipoDocumento).trim()
      : null;
  return { email, displayName, dni, phone, tipoDocumento };
}

/**
 * Valida email básico (tiene @ y dominio).
 */
function isValidEmail(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  const trimmed = str.trim().toLowerCase();
  return trimmed.includes('@') && trimmed.length >= 5;
}

/**
 * Genera contraseña para Firebase (mínimo 6 caracteres). Usa DNI; si es corto, rellena con ceros.
 */
function buildPasswordFromDni(dni) {
  if (dni == null || String(dni).trim() === '') return null;
  const normalized = String(dni).trim().replace(/\s/g, '');
  if (normalized.length >= MIN_PASSWORD_LENGTH) return normalized;
  return normalized.padStart(MIN_PASSWORD_LENGTH, '0');
}

/**
 * Crea o asegura una cuenta de usuario en el Portal a partir de los datos de un pedido.
 * No crea más de una cuenta por email (idempotente).
 *
 * @param {Object} pedidoRaw - Pedido del ERP (con id, email, nombre, dni, phone, etc.)
 * @param {{ linkOrderId?: boolean }} [options] - linkOrderId: si true, actualiza el pedido con userId
 * @returns {Promise<{ created: boolean, userId?: string, existing?: boolean, error?: string }>}
 */
export async function ensureAccountFromOrderData(pedidoRaw, options = {}) {
  const { linkOrderId = false } = options;

  if (!auth) {
    return { created: false, error: getFirebaseConfigMessage() };
  }

  const { email, displayName, dni, phone, tipoDocumento } =
    extraerDatosClienteDesdePedido(pedidoRaw);

  if (!isValidEmail(email)) {
    return { created: false, error: 'NO_EMAIL' };
  }

  const password = buildPasswordFromDni(dni);
  if (!password) {
    return { created: false, error: 'NO_DNI' };
  }

  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods && methods.length > 0) {
      return { created: false, existing: true };
    }
  } catch (err) {
    return {
      created: false,
      error: err?.message || 'Error al verificar email',
    };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    const profileData = {
      email: user.email,
      displayName: displayName || user.displayName || email,
      dni: dni || null,
      phone: phone || null,
      tipoDocumento: tipoDocumento || null,
      accessSystem: 'portal_clientes',
      accountOrigin: 'erp_auto',
      createdForPortalClientes: true,
    };
    const { error: setError } = await setDocument(PORTAL_USERS_COLLECTION, user.uid, profileData);
    if (setError) {
      return {
        created: true,
        userId: user.uid,
        error: `Cuenta creada pero perfil falló: ${setError}`,
      };
    }

    if (linkOrderId && pedidoRaw.id) {
      await updateOrderInERP(pedidoRaw.id, { userId: user.uid });
    }

    return { created: true, userId: user.uid };
  } catch (error) {
    const code = error?.code || '';
    const message = error?.message || '';
    return {
      created: false,
      error: code ? `${code}: ${message}` : message,
    };
  }
}

/**
 * Migra usuarios auto-creados legacy (users) hacia la nueva colección del portal.
 * Criterio: perfiles cuyo uid aparece en pedidos ERP como userId.
 */
export async function migrateLegacyAutoCreatedUsers(options = {}) {
  const maxPedidos = Number(options.maxPedidos) > 0 ? Number(options.maxPedidos) : 3000;
  const dryRun = !!options.dryRun;
  const batchSize = 150;
  const userIds = new Set();
  let loaded = 0;
  let lastDoc = null;

  while (loaded < maxPedidos) {
    const { data, lastDoc: nextDoc, error } = await getPedidosForAccountSync(batchSize, lastDoc);
    if (error) return { error, data: null };
    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) break;
    list.forEach((p) => {
      if (p?.userId) userIds.add(String(p.userId));
    });
    loaded += list.length;
    if (!nextDoc || list.length < batchSize) break;
    lastDoc = nextDoc;
  }

  let migrated = 0;
  let wouldMigrate = 0;
  let alreadyInTarget = 0;
  let notFoundInLegacy = 0;
  let deletedFromLegacy = 0;
  let deletedAlreadyMigrated = 0;
  let wouldDeleteFromLegacy = 0;
  let wouldDeleteAlreadyMigrated = 0;
  const errors = [];

  for (const uid of userIds) {
    const { data: targetProfile } = await getDocument(PORTAL_USERS_COLLECTION, uid);
    const { data: legacyProfile, error: legacyError } = await getDocument(LEGACY_USERS_COLLECTION, uid);

    if (targetProfile) {
      alreadyInTarget += 1;
      if (legacyProfile) {
        if (dryRun) {
          wouldDeleteAlreadyMigrated += 1;
          wouldDeleteFromLegacy += 1;
        } else {
          const { error: deleteError } = await deleteDocument(LEGACY_USERS_COLLECTION, uid);
          if (deleteError) {
            errors.push(`${uid}: ${deleteError}`);
          } else {
            deletedAlreadyMigrated += 1;
            deletedFromLegacy += 1;
          }
        }
      }
      continue;
    }
    if (!legacyProfile) {
      if (!legacyError || legacyError.includes('Documento no encontrado')) {
        notFoundInLegacy += 1;
        continue;
      }
      errors.push(`${uid}: ${legacyError}`);
      continue;
    }
    const { id, ...legacyData } = legacyProfile;
    const payload = {
      ...legacyData,
      accessSystem: 'portal_clientes',
      migratedFromLegacyUsers: true,
      migratedAtMs: Date.now(),
    };
    if (dryRun) {
      wouldMigrate += 1;
      wouldDeleteFromLegacy += 1;
      continue;
    }
    const { error: setError } = await setDocument(PORTAL_USERS_COLLECTION, uid, payload);
    if (setError) {
      errors.push(`${uid}: ${setError}`);
      continue;
    }
    const { data: confirmInTarget } = await getDocument(PORTAL_USERS_COLLECTION, uid);
    if (!confirmInTarget) {
      errors.push(`${uid}: No se pudo verificar en colección destino`);
      continue;
    }
    const { error: deleteError } = await deleteDocument(LEGACY_USERS_COLLECTION, uid);
    if (deleteError) {
      errors.push(`${uid}: ${deleteError}`);
      continue;
    }
    deletedFromLegacy += 1;
    migrated += 1;
  }

  return {
    error: null,
    data: {
      scannedPedidos: loaded,
      candidateUserIds: userIds.size,
      dryRun,
      migrated,
      wouldMigrate,
      alreadyInTarget,
      notFoundInLegacy,
      deletedFromLegacy,
      deletedAlreadyMigrated,
      wouldDeleteFromLegacy,
      wouldDeleteAlreadyMigrated,
      errors,
    },
  };
}
