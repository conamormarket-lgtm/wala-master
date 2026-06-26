import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  endAnalyticsSession,
  ensureAnalyticsSession,
  linkSessionToUser,
  trackPageView,
  trackRouteDwell,
} from '../../services/analytics/tracker';

// Si la app corre dentro de un iframe (p. ej. la preview del mapa de calor en el
// dashboard) NO registramos eventos: evita doble-conteo y escrituras innecesarias.
const IN_IFRAME = (typeof window !== 'undefined') && window.self !== window.top;

const RouteTracker = () => {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const lastPathRef = useRef(location.pathname || '/');
  const enteredAtRef = useRef(Date.now());

  const userCtx = {
    uid: user?.uid || null,
    email: user?.email || userProfile?.email || null,
    displayName: userProfile?.displayName || user?.displayName || null,
  };

  useEffect(() => {
    if (IN_IFRAME) return;
    ensureAnalyticsSession(userCtx, location.pathname || '/').catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (IN_IFRAME) return;
    const previousPath = lastPathRef.current;
    const now = Date.now();
    const dwell = now - enteredAtRef.current;
    if (previousPath) {
      trackRouteDwell(previousPath, dwell, userCtx).catch(() => {});
    }
    lastPathRef.current = location.pathname || '/';
    enteredAtRef.current = Date.now();
    trackPageView(location.pathname || '/', userCtx).catch(() => {});
  }, [location.pathname, userCtx.uid, userCtx.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (IN_IFRAME) return;
    if (!userCtx.uid) return;
    linkSessionToUser(userCtx).catch(() => {});
  }, [userCtx.uid, userCtx.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (IN_IFRAME) return undefined;
    const handleVisibilityChange = () => {
      const path = lastPathRef.current;
      if (!path) return;
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        const dwell = now - enteredAtRef.current;
        trackRouteDwell(path, dwell, userCtx).catch(() => {});
        enteredAtRef.current = now;
      } else if (document.visibilityState === 'visible') {
        enteredAtRef.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      const path = lastPathRef.current;
      const dwell = Date.now() - enteredAtRef.current;
      trackRouteDwell(path, dwell, userCtx).catch(() => {});
      endAnalyticsSession(userCtx, path).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userCtx.uid, userCtx.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

export default RouteTracker;
