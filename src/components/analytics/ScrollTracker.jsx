import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackScrollDepth } from '../../services/analytics/tracker';
import { useAuth } from '../../contexts/AuthContext';

// Si la app corre dentro de un iframe (preview del mapa de calor) NO registramos
// scroll: evita doble-conteo y escrituras innecesarias en Firestore.
const IN_IFRAME = (typeof window !== 'undefined') && window.self !== window.top;

export default function ScrollTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const reportedDepths = useRef(new Set());

  useEffect(() => {
    if (IN_IFRAME) return undefined;
    // Reset reported depths on route change
    reportedDepths.current.clear();

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (height <= 0) return;

      const percentage = (scrollY / height) * 100;
      const marks = [25, 50, 75, 90];

      marks.forEach((mark) => {
        if (percentage >= mark && !reportedDepths.current.has(mark)) {
          reportedDepths.current.add(mark);
          trackScrollDepth(mark, user).catch(console.error);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname, user]);

  return null;
}
