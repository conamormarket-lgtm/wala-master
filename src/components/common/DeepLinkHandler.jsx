import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

const DeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Only register listener in Capacitor environment
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('appUrlOpen', data => {
      if (data.url) {
        try {
          const url = new URL(data.url);
          // Verificar que el dominio corresponde
          if (url.hostname === 'wala.pe' || url.hostname === 'www.wala.pe') {
            const path = url.pathname + url.search + url.hash;
            navigate(path);
          }
        } catch (e) {
          console.error("Error parsing deep link URL", e);
        }
      }
    });

    return () => {
      listener.then(l => l.remove()).catch(console.error);
    };
  }, [navigate]);

  return null;
};

export default DeepLinkHandler;
