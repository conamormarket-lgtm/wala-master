import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * /invitar/:codigo — link de invitación permanente de cada cuenta (Mis
 * Referidos). Quien no tiene sesión va a crear su cuenta; quien ya la tiene, a
 * la tienda. En los dos casos con ?ref=CODIGO&tipo=invitacion: ReferralTracker
 * lo registra y, si resulta ser una cuenta nueva, le da el bono de bienvenida.
 */
const InvitarPage = () => {
  const { codigo = '' } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const params = `?ref=${encodeURIComponent(codigo.trim().toUpperCase())}&tipo=invitacion`;
    const conCuenta = user && !user.isAnonymous;
    navigate(`${conCuenta ? '/' : '/registro'}${params}`, { replace: true });
  }, [codigo, user, loading, navigate]);

  return null;
};

export default InvitarPage;
