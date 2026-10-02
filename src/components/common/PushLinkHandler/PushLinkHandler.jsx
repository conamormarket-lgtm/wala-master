import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { escucharLinksDePush, tomarLinkPendiente, irALink } from '../../../utils/pushLink';

// Navega al link de una push tocada (ver src/utils/pushLink.js). No pinta nada.
const PushLinkHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const pendiente = tomarLinkPendiente();
    if (pendiente) irALink(navigate, pendiente);
    return escucharLinksDePush((link) => irALink(navigate, link));
  }, [navigate]);
  return null;
};

export default PushLinkHandler;
