import { useEffect } from 'react';
import { useNotifications } from './useNotifications';

const VIEWS_STORAGE_KEY = 'product_views_history';

export const useProductTracking = (product) => {
  const { requestPermission } = useNotifications();

  useEffect(() => {
    if (!product || !product.id) return;

    try {
      const historyStr = localStorage.getItem(VIEWS_STORAGE_KEY);
      let history = historyStr ? JSON.parse(historyStr) : {};

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Limpiar historial viejo (opcional, para no inflar el storage)
      Object.keys(history).forEach(pid => {
        history[pid] = history[pid].filter(view => new Date(view.date) > sevenDaysAgo);
        if (history[pid].length === 0) delete history[pid];
      });

      // Agregar nueva vista
      const currentViews = history[product.id] || [];
      const newView = {
        date: now.toISOString(),
        price: product.salePrice || product.price,
        name: product.name
      };

      currentViews.push(newView);
      history[product.id] = currentViews;

      localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(history));

      // Lógica de notificación local: si lo vio 3 o más veces y no ha sido notificado hoy
      if (currentViews.length >= 3) {
        const notifKey = `notified_behavior_${product.id}`;
        const lastNotifiedStr = localStorage.getItem(notifKey);
        const lastNotified = lastNotifiedStr ? new Date(lastNotifiedStr) : null;
        
        // Solo notificar si no lo hemos notificado en las últimas 24h por este producto
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (!lastNotified || lastNotified < oneDayAgo) {
          
          // Enviar alerta local si el navegador lo permite
          if (Notification.permission === 'granted') {
            new Notification('¡Sigue disponible!', {
              body: `Ese ${product.name} que estuviste viendo te está esperando. ¿Te lo separamos?`,
              icon: product.images?.[0] || '/logo192.png'
            });
          } else {
            // Podríamos intentar pedir permisos si es la primera vez que vemos este trigger
            requestPermission();
          }

          localStorage.setItem(notifKey, now.toISOString());
        }
      }

    } catch (err) {
      console.warn("Error rastreando visita de producto:", err);
    }
  }, [product, requestPermission]);
};
