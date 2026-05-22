import { LocalNotifications } from '@capacitor/local-notifications';

export const scheduleKapiNotifications = async (userProfile) => {
  if (!userProfile) return;
  
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') return;
    }

    // Cancel previous Kapi notifications (IDs 10 to 19)
    const pending = await LocalNotifications.getPending();
    const kapiPending = pending.notifications.filter(n => n.id >= 10 && n.id <= 19);
    if (kapiPending.length > 0) {
      await LocalNotifications.cancel({ notifications: kapiPending.map(n => ({ id: n.id })) });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    
    const kapiCoins = userProfile.kapiCoins || 0;
    const toSchedule = [];

    // Helper to create date for current month
    const createDate = (day, hour = 10) => {
      const d = new Date(year, month, day, hour, 0, 0, 0);
      return d;
    };
    
    // Helper to create date for next month
    const createNextMonthDate = (day, hour = 10) => {
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
      }
      return new Date(nextYear, nextMonth, day, hour, 0, 0, 0);
    };

    // 1. Día 15, 10:00
    if (currentDay < 15 && kapiCoins < 10) {
      toSchedule.push({
        id: 11,
        title: "¡No pierdas tus monedas!",
        body: `Llevas solo ${kapiCoins} monedas este mes. Cada día sin reclamar es una moneda perdida`,
        schedule: { at: createDate(15), allowWhileIdle: true }
      });
    }

    // 2. Día 25, 10:00
    if (currentDay < 25) {
      const diasRestantes = lastDayOfMonth - 25;
      toSchedule.push({
        id: 12,
        title: "¡Apresúrate!",
        body: `Te quedan ${diasRestantes} días para acumular y gastar. El día ${lastDayOfMonth} se borran`,
        schedule: { at: createDate(25), allowWhileIdle: true }
      });
    }

    // 3. Último día - 3, 10:00
    const dayMinus3 = lastDayOfMonth - 3;
    if (currentDay < dayMinus3 && kapiCoins > 5) {
      toSchedule.push({
        id: 13,
        title: "¡Monedas a punto de expirar!",
        body: `Tienes ${kapiCoins} monedas diarias que se borran en 3 días. ¿Ya las gastaste?`,
        schedule: { at: createDate(dayMinus3), allowWhileIdle: true }
      });
    }

    // 4. Último día, 10:00
    if (currentDay < lastDayOfMonth && kapiCoins > 0) {
      toSchedule.push({
        id: 14,
        title: "¡Última Oportunidad!",
        body: `HOY a medianoche se borran tus ${kapiCoins} monedas. Última oportunidad`,
        schedule: { at: createDate(lastDayOfMonth), allowWhileIdle: true }
      });
    }

    // 5. Día 1 del próximo mes, 10:00
    // Evaluate based on current state (this will accurately reflect their end-of-month state 
    // assuming they don't open the app again before the month ends).
    let nextMonthTitle = "¡Nuevo Mes!";
    let nextMonthBody = "Nuevo mes, nuevas monedas. Reclama la primera del mes 🌟";
    
    if (kapiCoins > 0) {
      nextMonthBody = `Se fueron ${kapiCoins} monedas que no usaste. Este mes no las dejes escapar`;
    } else if (kapiCoins === 0 && userProfile.kapiHappiness > 0) { // If they had some interaction but spent it all
      nextMonthBody = "¡Gastaste todas! Eres un pro. Nuevo mes, nueva oportunidad 🎉";
    }

    toSchedule.push({
      id: 15,
      title: nextMonthTitle,
      body: nextMonthBody,
      schedule: { at: createNextMonthDate(1), allowWhileIdle: true }
    });

    // -----------------------------------------------------
    // 6. RULETA SEMANAL - Notificaciones contextuales (basadas en estado actual)
    // Se cancelan a diario y se reprograman si el usuario entra a la app
    // Usaremos las IDs 16, 17, 18
    const currentDayOfWeek = now.getDay(); // 0: Sunday, 1: Monday, 5: Friday
    const currentWeeklyClaims = userProfile?.weeklyClaimsData?.daysClaimed || [];
    const daysCount = currentWeeklyClaims.length;

    let extraTitle = "¡Kapi tiene hambre! 🍖";
    let extraBody = "Alimenta a Kapi hoy para mantenerlo feliz y sumar monedas.";

    if (currentDayOfWeek === 1) {
      extraTitle = "Nueva semana 🎰";
      extraBody = "Alimenta a Kapi 7/7 días y desbloquea la Ruleta Semanal.";
    } else if (currentDayOfWeek === 5 && daysCount >= 4) {
      extraTitle = "¡Llevas 5/5 días! 🎰"; 
      extraBody = "Dos más y giras la ruleta. No falles ahora.";
    } else if (currentDayOfWeek === 0) {
      if (daysCount >= 6) {
        extraTitle = "¡Ruleta a punto de desbloquearse! 🎰";
        extraBody = "Alimenta a Kapi por última vez y gira antes de medianoche.";
      } else {
        extraTitle = `Perdiste días esta semana ❌`;
        extraBody = "Alimenta a Kapi hoy, y la próxima semana no se te escape la ruleta.";
      }
    }

    // Programar recordatorio diario (ID 16) si aún no ha alimentado a Kapi hoy
    const todayStr = now.toISOString().split('T')[0];
    if (userProfile.lastKapiClaimDate !== todayStr) {
      // Programar para dentro de 2 horas desde que abrió la app, o a las 18:00
      let notifyTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); 
      toSchedule.push({
        id: 16,
        title: extraTitle,
        body: extraBody,
        schedule: { at: notifyTime, allowWhileIdle: true }
      });
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    console.log("Notificaciones locales no disponibles o error:", e);
  }
};
