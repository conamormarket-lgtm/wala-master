import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/*
 * El aviso del reto del día de Las Bolitas de Kapi, en la app (aviso local,
 * sin servidor). Como los de Kapi (kapiNotifications.js): solo en la app y
 * solo si la persona ya dio el permiso con "Activar avisos"; nunca se pide
 * desde aquí.
 *  - Si el reto de hoy está hecho, el aviso queda para mañana; si no, para
 *    hoy (si todavía no pasó la hora).
 *  - Usa el ID 30 (los de Kapi van del 10 al 19).
 */
const ID_RETO = 30;
const HORA_AVISO = 19; // 7 de la noche, hora del celular

export async function programarAvisoReto({ retoHecho }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const permiso = await LocalNotifications.checkPermissions();
    if (permiso.display !== 'granted') return;
    await LocalNotifications.cancel({ notifications: [{ id: ID_RETO }] });

    const cuando = new Date();
    cuando.setHours(HORA_AVISO, 0, 0, 0);
    if (retoHecho || cuando.getTime() <= Date.now()) cuando.setDate(cuando.getDate() + 1);

    await LocalNotifications.schedule({
      notifications: [{
        id: ID_RETO,
        title: 'Tu reto de Las Bolitas está listo',
        body: 'Un nivel nuevo, el mismo para todos. ¿Cuántos movimientos te toma?',
        schedule: { at: cuando, allowWhileIdle: true },
        extra: { ruta: '/ball-sort' },
      }],
    });
  } catch (e) {
    console.log('Aviso del reto no disponible:', e);
  }
}
