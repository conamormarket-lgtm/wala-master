import React from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { EN_VISTA_PREVIA_CALOR } from '../../utils/vistaPreviaCalor';
import { BarraAdmin } from '../../componentes/kit/piezas/Marco';

/*
 * Barra de admin (M3) con el kit. Mismas reglas que AdminBar:
 *  - Solo admins, y nunca en la vista previa del mapa de calor (la página
 *    tiene que verse como la vio el visitante).
 *  - En la ficha de un producto: "Editar este producto" → su página del panel.
 *  - En el panel, el login y el registro: solo el acceso al panel.
 *  - En el resto: el panel y el editor visual. En la app nativa no se edita
 *    la página, así que ahí no sale.
 * Va pegada arriba y publica su alto (--admin-bar-height) para la cabecera.
 */
export default function BarraDeAdmin() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const { isEditModeActive, toggleEditMode } = useVisualEditor();

  if (!isAdmin || EN_VISTA_PREVIA_CALOR) return null;

  if (pathname.startsWith('/producto/')) {
    const id = pathname.split('/')[2];
    return <BarraAdmin fija editarEn={`/admin/productos/${id}`} textoEditor="Editar este producto" />;
  }

  if (['/admin', '/login', '/registro'].some((r) => pathname.startsWith(r))) {
    return <BarraAdmin fija />;
  }

  if (Capacitor.isNativePlatform()) return null;

  return <BarraAdmin fija editando={isEditModeActive} onEditor={toggleEditMode} />;
}
