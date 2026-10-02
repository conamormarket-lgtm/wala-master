import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { escucharLinksDePush, tomarLinkPendiente, irALink, registrarApertura } from '../../../utils/pushLink';

// Navega al link de una push tocada (ver src/utils/pushLink.js). No pinta nada.
const PushLinkHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // La notificación del navegador abre la web con ?notif=… (o ?camp=…): se
  // registra la apertura y se limpia la URL.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const notifId = params.get('notif');
    const campaignId = params.get('camp');
    if (!notifId && !campaignId) return;
    registrarApertura({ notifId: notifId || undefined, campaignId: campaignId || undefined });
    params.delete('notif');
    params.delete('camp');
    const resto = params.toString();
    navigate(`${location.pathname}${resto ? `?${resto}` : ''}${location.hash}`, { replace: true });
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pendiente = tomarLinkPendiente();
    if (pendiente) irALink(navigate, pendiente);
    return escucharLinksDePush((link) => irALink(navigate, link));
  }, [navigate]);
  return null;
};

export default PushLinkHandler;
