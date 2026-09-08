// =========================================================================
// Cupones del usuario
// -------------------------------------------------------------------------
// La colección `userCoupons` existía desde el canje de recompensas, pero nadie
// la leía: los cupones se creaban y se quedaban ahí, sin pantalla donde verlos
// y sin forma de aplicarlos. Este módulo es la parte de lectura; el descuento
// real lo aplica el servidor (aplicarCuponSecure) en el checkout, para que el
// valor del cupón no dependa de lo que diga el navegador.
// =========================================================================

import { db } from './firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { limaTodayStr } from '../utils/fechaLima';

const COLECCION = 'userCoupons';

/**
 * Estado real del cupón HOY: el campo `status` no basta porque la caducidad no
 * la escribe nadie (el cupón no se "apaga" solo al vencer).
 * Devuelve 'usado' | 'caducado' | 'activo'.
 */
export const estadoCupon = (cupon) => {
  if (!cupon) return 'caducado';
  if (cupon.status === 'used' || cupon.orderId) return 'usado';
  if (cupon.expiraEn && cupon.expiraEn < limaTodayStr()) return 'caducado';
  return 'activo';
};

/**
 * ¿Este cupón se puede aplicar en el checkout? Los cupones viejos del catálogo
 * de recompensas no llevan tipo ni valor: existen como comprobante, pero no hay
 * nada que descontar, así que se muestran sin botón de aplicar.
 */
export const esAplicable = (cupon) =>
  estadoCupon(cupon) === 'activo' && !!cupon?.tipo;

/** Cupones del usuario, los más nuevos primero. */
export const getMisCupones = async (uid) => {
  if (!uid) return { data: [], error: null };
  try {
    const q = query(
      collection(db, COLECCION),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return { data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null };
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    return { data: [], error: error?.message || 'No pudimos cargar tus cupones' };
  }
};

/**
 * Valida un código en el checkout y devuelve el descuento que corresponde.
 * NO marca el cupón como usado: eso ocurre al confirmar el pedido (canjearCupon).
 */
export const validarCupon = async (code, { subtotal, envio, items }) => {
  try {
    const res = await httpsCallable(getFunctions(), 'validarCuponSecure')({
      code, subtotal, envio, items,
    });
    // `envioGratis` y `aviso` se devuelven tal cual: sin el primero el checkout
    // no sabe que debe poner el envío a cero, y sin el segundo pierde el motivo
    // exacto por el que un cupón no resta nada y acaba enseñando un mensaje
    // genérico ("no aplica a tu carrito") que no ayuda a nadie.
    return {
      success: true,
      cupon: res.data?.cupon,
      descuento: res.data?.descuento || 0,
      envioGratis: !!res.data?.envioGratis,
      aviso: res.data?.aviso || '',
    };
  } catch (error) {
    return { success: false, error: error?.message || 'No pudimos validar el cupón' };
  }
};

/** Marca el cupón como usado por un pedido. Idempotente por (cupón, pedido). */
export const canjearCupon = async (code, orderId) => {
  try {
    const res = await httpsCallable(getFunctions(), 'canjearCuponSecure')({ code, orderId });
    return { success: true, descuento: res.data?.descuento || 0 };
  } catch (error) {
    return { success: false, error: error?.message || 'No pudimos canjear el cupón' };
  }
};
