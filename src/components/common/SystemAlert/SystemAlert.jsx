import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';
import { AlertCircle } from 'lucide-react';
import './SystemAlert.css';

const SystemAlert = () => {
  const [alertConfig, setAlertConfig] = useState(null);

  useEffect(() => {
    // Referencia al documento 'estado_app' en la colección 'configuracion'
    const docRef = doc(db, 'configuracion', 'estado_app');

    // Escucha en tiempo real (onSnapshot)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setAlertConfig(docSnap.data());
      } else {
        // Si el documento no existe o fue borrado, no mostramos nada
        setAlertConfig(null);
      }
    }, (error) => {
      console.warn("Error escuchando el estado de la app:", error);
    });

    // Cleanup: Desuscribirse cuando el componente se desmonte
    return () => unsubscribe();
  }, []);

  // Si no hay configuración o mostrarAviso es false, no renderizamos nada
  if (!alertConfig || alertConfig.mostrarAviso !== true) {
    return null;
  }

  // Estilos dinámicos basados en el tipo de alerta (opcional)
  // Por defecto usamos 'warning', pero podría ser 'info' o 'error' desde Firebase
  const alertType = alertConfig.tipo || 'warning';

  return (
    <div className={`system-alert-banner system-alert-${alertType}`}>
      <div className="system-alert-content">
        <AlertCircle size={20} className="system-alert-icon" />
        <p className="system-alert-text">
          {alertConfig.mensaje || "Tenemos una actualización importante programada."}
        </p>
      </div>
    </div>
  );
};

export default SystemAlert;
