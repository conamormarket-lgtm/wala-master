import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument, deleteDocument } from '../services/firebase/firestore';
import PaypalEnlaceCheckout from '../components/PaypalCheckout/PaypalEnlaceCheckout';

const PagoRapidoPage = () => {
  const { id } = useParams();
  const [enlace, setEnlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagoCompletado, setPagoCompletado] = useState(false);

  useEffect(() => {
    const fetchEnlace = async () => {
      setLoading(true);
      const { data, error: fetchError } = await getDocument('enlaces_pago', id);
      
      if (fetchError || !data) {
        setError('El enlace de pago no es válido o no existe.');
      } else {
        // Verificar expiración (36 horas)
        if (data.createdAt) {
          // data.createdAt es un Timestamp de Firestore
          const createdAtDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          const now = new Date();
          const diffInHours = (now - createdAtDate) / (1000 * 60 * 60);
          
          if (diffInHours > 36 && data.estado !== 'pagado') {
            // Eliminar el enlace de la base de datos para no ocupar espacio basura
            await deleteDocument('enlaces_pago', id);
            
            setError('Este enlace de pago ha expirado y ha sido eliminado del sistema.');
            setLoading(false);
            return;
          }
        }

        setEnlace(data);
        if (data.estado === 'pagado') {
          setPagoCompletado(true);
        }
      }
      setLoading(false);
    };

    if (id) {
      fetchEnlace();
    }
  }, [id]);

  const handlePagoExitoso = (details) => {
    setPagoCompletado(true);
    // Opcionalmente actualizar el estado local
    setEnlace(prev => ({ ...prev, estado: 'pagado', paypalOrderId: details.id }));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Cargando detalles del pago...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ color: '#334155', marginTop: '1rem' }}>Enlace no encontrado</h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: '450px', width: '100%', background: 'white', padding: '2.5rem 2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo-wala.svg" alt="Walá" style={{ height: '40px', marginBottom: '1rem' }} onError={(e) => { e.target.style.display = 'none' }} />
          <h1 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Pago Rápido</h1>
        </div>

        {pagoCompletado ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#16a34a', marginBottom: '0.5rem', fontSize: '1.5rem' }}>¡Pago Exitoso!</h2>
            <p style={{ color: '#475569' }}>
              Tu pago por <strong>${Number(enlace.montoUSD).toFixed(2)} USD</strong> se ha procesado correctamente.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1.5rem' }}>
              ID de Transacción: {enlace?.paypalOrderId || 'Procesado'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ background: '#f1f5f9', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Concepto</p>
              <p style={{ margin: '0 0 1.25rem 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: 500 }}>{enlace.concepto}</p>
              
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: '#64748b' }}>Total a pagar</span>
                <span style={{ color: '#0f172a', fontSize: '1.75rem', fontWeight: 'bold' }}>
                  ${Number(enlace.montoUSD).toFixed(2)} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'normal' }}>USD</span>
                </span>
              </div>
            </div>

            <PaypalEnlaceCheckout enlace={enlace} onSuccess={handlePagoExitoso} />
            
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '2rem' }}>
              Pagos procesados de forma segura a través de PayPal.
            </p>
          </>
        )}
        
      </div>
    </div>
  );
};

export default PagoRapidoPage;
