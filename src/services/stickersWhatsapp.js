import { Capacitor, registerPlugin } from '@capacitor/core';
import { getFunctions, httpsCallable } from 'firebase/functions';

/*
 * Stickers de WhatsApp canjeados en el catálogo de recompensas.
 *
 * El pack lo añade la app de Android: su plugin nativo StickersWhatsapp
 * (android/app/src/main/java/com/wala/tienda/stickers) abre WhatsApp con el
 * pack que la app trae dentro. En la web no hay forma de hacerlo: se manda a
 * Google Play. Cuando WhatsApp lo acepta, stickersAgregadosSecure marca el
 * canje como entregado (Recompensas › Canjes del admin).
 */

const NOMBRE = 'StickersWhatsapp';
const plugin = registerPlugin(NOMBRE);

/** 'app' (se puede añadir aquí) | 'actualizar' (app vieja sin el plugin) | 'web'. */
export function modoStickers() {
  if (!Capacitor.isNativePlatform()) return 'web';
  if (Capacitor.getPlatform() !== 'android') return 'web';
  return Capacitor.isPluginAvailable(NOMBRE) ? 'app' : 'actualizar';
}

/** { whatsapp, agregado, existe } del teléfono; null fuera de la app. */
export async function estadoStickers(packId) {
  if (modoStickers() !== 'app') return null;
  try {
    return await plugin.estado({ packId });
  } catch {
    return null;
  }
}

/**
 * Abre WhatsApp para añadir el pack y, si quedó, avisa al servidor.
 * → { agregado, cancelado }. Falla con el mensaje para el cliente.
 */
export async function agregarStickers({ packId, couponId }) {
  const r = await plugin.agregar({ packId });
  if (r?.agregado && couponId) {
    // Si el aviso falla, los stickers ya están en WhatsApp: solo el admin no lo ve.
    await httpsCallable(getFunctions(), 'stickersAgregadosSecure')({ couponId }).catch(() => {});
  }
  return { agregado: Boolean(r?.agregado), cancelado: Boolean(r?.cancelado) };
}
