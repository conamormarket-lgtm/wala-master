import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from '../../services/firebase/observed.js';
import { db } from '../../services/firebase/config';
import { AvisoSistema } from '../../componentes/kit/piezas/Marco';
import { avisoDesdeEstadoApp } from '../../componentes/kit/adaptadores';

/*
 * Aviso del sistema (M1) con el kit: la franja de arriba para mantenimientos
 * o demoras. Escucha configuracion/estado_app en tiempo real; sale solo con
 * mostrarAviso === true. Sin X, como antes: lo quita el admin en Firestore.
 * Reemplaza a components/common/SystemAlert.
 */
export default function AvisoDelSistema() {
  const [estado, setEstado] = useState(null);

  useEffect(() => onSnapshot(
    doc(db, 'configuracion', 'estado_app'),
    (snap) => setEstado(snap.exists() ? snap.data() : null),
    (error) => console.warn('Error escuchando el estado de la app:', error),
  ), []);

  const aviso = avisoDesdeEstadoApp(estado);
  if (!aviso) return null;
  return <AvisoSistema tipo={aviso.tipo}>{aviso.mensaje}</AvisoSistema>;
}
