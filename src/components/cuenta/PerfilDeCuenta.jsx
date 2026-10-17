import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { uploadFile, deleteFile } from '../../services/firebase/storage';
import { COUNTRIES, dialCodeByCountry } from '../../constants/countries';
import { PaginaPerfil } from '../../componentes/kit/paginas/Cuenta';
import { perfilDesdeUsuario } from '../../componentes/kit/adaptadores';

/*
 * Mi perfil (/cuenta/perfil), paso 6 de la migración: PaginaPerfil del kit.
 * Lo de antes, en pages/cuenta/PerfilViejo.jsx (interruptor cuentaVieja).
 *
 * Se guarda lo mismo que antes (PerfilPage): el documento repetido en dni,
 * clienteNumeroDocumento y envioNumeroDocumento; el tipo en tipoDocumento,
 * clienteTipoDocumento y docType ('OTRO' fuera del Perú); en el Perú el
 * celular solo con números y, fuera, phone con el código del país y phoneIntl.
 * La foto: el kit la recorta (RecortarFoto, 512 px) y aquí se sube a
 * users/{uid}/avatars/…; la anterior se borra solo cuando la nueva quedó
 * guardada.
 */

const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));

/** Los datos del formulario → los campos del perfil (los de PerfilPage). */
function cambiosDelPerfil(form) {
  const peru = (form.pais || 'PE') === 'PE';
  const documento = peru ? String(form.documento || '').replace(/\s/g, '') : String(form.documento || '').trim();
  const tipo = peru ? (form.tipoDocumento || 'DNI') : 'OTRO';
  const cambios = {
    displayName: String(form.nombre || '').trim(),
    country: form.pais || 'PE',
    dni: documento,
    clienteNumeroDocumento: documento,
    envioNumeroDocumento: documento,
    tipoDocumento: tipo,
    clienteTipoDocumento: tipo,
    docType: tipo,
    birthDate: form.cumpleanos || '',
  };
  if (peru) {
    cambios.phone = String(form.telefono || '').replace(/\D/g, '');
  } else {
    const dialCode = dialCodeByCountry(form.pais) || '';
    const localNumber = String(form.telefono || '').trim();
    cambios.phone = `${dialCode}${localNumber}`;
    cambios.phoneIntl = { dialCode, localNumber, full: `${dialCode}${localNumber}` };
  }
  return cambios;
}

export default function PerfilDeCuenta() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const toast = useGlobalToast();
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardandoWhatsapp, setGuardandoWhatsapp] = useState(false);

  // Sin el perfil real (no llegó o falló la lectura) no se edita: se escribiría encima.
  const cargando = !user || !userProfile || userProfile._perfilNoCargado;
  const configFoto = userProfile?.avatarConfig || {};

  const guardar = async (form) => {
    const { error } = await updateUserProfile(cambiosDelPerfil(form));
    if (error) {
      toast.error('Error al guardar datos personales');
      throw new Error('No pudimos guardar tus datos. Inténtalo de nuevo.');
    }
    toast.success('Datos actualizados correctamente');
  };

  const cambiarFoto = async (blob) => {
    if (!user?.uid) throw new Error('No se pudo identificar tu cuenta. Refresca la página e inténtalo de nuevo.');
    setSubiendoFoto(true);
    const anterior = configFoto.avatarUrl;
    try {
      const { url, error } = await uploadFile(blob, `users/${user.uid}/avatars/${Date.now()}_cropped.jpg`);
      if (error || !url) throw new Error('No se pudo subir la foto. Inténtalo de nuevo.');
      // Sin los restos del avatar 3D de antes (isRpm, glbUrl).
      const { error: errorGuardar } = await updateUserProfile({ avatarConfig: { ...configFoto, isRpm: false, avatarUrl: url, glbUrl: null } });
      if (errorGuardar) throw new Error('La foto se subió pero no se pudo guardar. Inténtalo de nuevo.');
      if (anterior) deleteFile(anterior).catch(() => {});
      toast.success('Foto de perfil actualizada');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async () => {
    const anterior = configFoto.avatarUrl;
    if (!anterior) return;
    const { error } = await updateUserProfile({ avatarConfig: { ...configFoto, avatarUrl: null } });
    if (error) throw new Error('No se pudo guardar el cambio. Inténtalo de nuevo.');
    deleteFile(anterior).catch(() => {});
    toast.success('Quitamos tu foto de perfil');
  };

  // Ofertas por WhatsApp: se guarda al tocarlo, con la fecha del cambio (constancia).
  const cambiarWhatsapp = async (valor) => {
    setGuardandoWhatsapp(true);
    const { error } = await updateUserProfile({
      marketingConsent: { ...(userProfile?.marketingConsent || {}), whatsapp: valor, updatedAt: new Date().toISOString() },
    });
    setGuardandoWhatsapp(false);
    if (error) toast.error('No pudimos guardar tu preferencia');
    else toast.success(valor ? '¡Listo! Te avisaremos de ofertas por WhatsApp' : 'Ya no te enviaremos ofertas por WhatsApp');
  };

  return (
    <PaginaPerfil
      cargando={cargando}
      perfil={cargando ? {} : perfilDesdeUsuario(userProfile, user)}
      monedas={Number(userProfile?.monedas) || 0}
      enEspera={Number(userProfile?.monedasEnEspera) || 0}
      paises={PAISES}
      whatsapp={userProfile?.marketingConsent?.whatsapp === true}
      onWhatsapp={cambiarWhatsapp}
      guardandoWhatsapp={guardandoWhatsapp}
      onGuardar={guardar}
      onCambiarFoto={cambiarFoto}
      onQuitarFoto={quitarFoto}
      subiendoFoto={subiendoFoto}
    />
  );
}
