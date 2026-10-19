import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useInvitacionReferido from '../../hooks/useInvitacionReferido';
import {
  registrarVisita, leerReferidoGuardado, guardarReferido, BONO_BIENVENIDA_INVITACION,
} from '../../services/referrals';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaInvitacion } from '../../componentes/kit/paginas/Invitacion';

/*
 * La invitación (/invitar/:código) con el kit (paso 6, CAMPANAS.md). Antes la
 * página no mostraba nada: llevaba al registro (o al inicio, con cuenta) con
 * ?ref=CÓDIGO&tipo=invitacion para que ReferralTracker registrara la visita.
 * Ahora la página explica la invitación primero, y por eso registra la visita
 * ella misma (registrarVisitaReferidoSecure), igual que el tracker y con el
 * mismo wala_referral: así sabe también si el código no existe o es el tuyo.
 *  - "Crear mi cuenta" lleva al registro con ?ref=…&tipo=invitacion, como
 *    antes (el tracker ve el mismo link y no lo registra dos veces)
 *  - con cuenta, el tracker acepta la invitación (aceptarInvitacionSecure);
 *    la página muestra lo que decidió: aceptada (el bono), no aplica (ya
 *    tenías cuenta) o que faltan el DNI y el celular
 *  - "Ya tengo cuenta" vuelve aquí después de entrar
 * Lo de antes: pages/InvitarViejo.jsx (interruptor campanasViejo).
 */

// Mientras el servidor decide la invitación de una cuenta con datos. Si en
// este tiempo no responde (sin red), la página no se queda cargando.
const ESPERA_DECISION_MS = 12000;
// Registrar la visita: si el servidor no responde en este tiempo, "Reintentar".
const ESPERA_VISITA_MS = 15000;

// Una sola visita por código aunque el efecto corra dos veces (el modo
// estricto de React en desarrollo, o volver a la página enseguida).
const enCurso = new Map();
const registrarUnaVez = (codigo) => {
  if (!enCurso.has(codigo)) {
    const tope = new Promise((resolver) => { setTimeout(() => resolver({ id: null, tope: true }), ESPERA_VISITA_MS); });
    const pedido = Promise.race([registrarVisita({ code: codigo, tipo: 'invitacion' }), tope])
      .finally(() => setTimeout(() => enCurso.delete(codigo), 2000));
    enCurso.set(codigo, pedido);
  }
  return enCurso.get(codigo);
};

export default function InvitacionDeTienda() {
  const { codigo: crudo = '' } = useParams();
  const codigo = crudo.trim().toUpperCase();
  const { user, userProfile, loading } = useAuth();
  const invitacion = useInvitacionReferido();
  const [visita, setVisita] = useState({ estado: 'cargando' });
  const [intento, setIntento] = useState(0);
  const [esperaVencida, setEsperaVencida] = useState(false);
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();

  // La visita: la de este código si ya está guardada; si no, se registra.
  useEffect(() => {
    if (loading) return undefined;
    if (miCodigo && codigo === miCodigo) { setVisita({ estado: 'propia' }); return undefined; }
    const guardado = leerReferidoGuardado();
    if (guardado?.referrerCode === codigo && guardado.tipo === 'invitacion') {
      setVisita({ estado: 'lista' });
      return undefined;
    }
    let vivo = true;
    setVisita({ estado: 'cargando' });
    registrarUnaVez(codigo).then(({ id, nombre, motivo }) => {
      if (!vivo) return;
      if (motivo === 'propio') { setVisita({ estado: 'propia' }); return; }
      if (motivo === 'codigo') { setVisita({ estado: 'invalida' }); return; }
      if (!id) { setVisita({ estado: 'error' }); return; }
      // Ya guardada por la otra corrida del efecto: no se pisa (ni su decisión).
      if (leerReferidoGuardado()?.referralId === id) { setVisita({ estado: 'lista' }); return; }
      guardarReferido({ referrerCode: codigo, referralId: id, timestamp: Date.now(), tipo: 'invitacion', nombre: nombre || null });
      setVisita({ estado: 'lista' });
    });
    return () => { vivo = false; };
  }, [codigo, loading, miCodigo, intento]);

  const conCuenta = tieneCuenta(user);
  const decision = invitacion?.tipo === 'invitacion' ? invitacion.invitacion : undefined;
  const faltanDatos = conCuenta && userProfile && !userProfile._perfilNoCargado && !(userProfile.dni && userProfile.phone);
  const esperandoDecision = visita.estado === 'lista' && conCuenta && !decision && !faltanDatos;

  useEffect(() => {
    setEsperaVencida(false);
    if (!esperandoDecision) return undefined;
    const id = setTimeout(() => setEsperaVencida(true), ESPERA_DECISION_MS);
    return () => clearTimeout(id);
  }, [esperandoDecision]);

  let estado = visita.estado;
  if (loading) estado = 'cargando';
  else if (estado === 'lista') {
    if (!conCuenta) estado = 'nueva';
    else if (decision === 'aceptada') estado = 'aceptada';
    else if (decision === 'no_aplica') estado = 'conCuenta';
    else if (faltanDatos) estado = 'faltanDatos';
    else estado = esperaVencida ? 'conCuenta' : 'cargando';
  }

  const ref = `?ref=${encodeURIComponent(codigo)}&tipo=invitacion`;
  return (
    <PaginaInvitacion
      nombre={invitacion?.nombre || undefined}
      estado={estado}
      bono={BONO_BIENVENIDA_INVITACION}
      onReintentar={() => setIntento((n) => n + 1)}
      urlRegistro={`/registro${ref}`}
      urlLogin={`/login?redirect=${encodeURIComponent(`/invitar/${codigo}`)}`}
      urlTienda="/tienda"
      urlPerfil="/cuenta/perfil"
      urlReferidos="/cuenta/referidos"
    />
  );
}
