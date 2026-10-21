import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import { EN_VISTA_PREVIA_CALOR } from '../../utils/vistaPreviaCalor';
import { BarraAdmin } from '../../componentes/kit/piezas/Marco';
import { useConfirmar } from '../../componentes/kit/Feedback';

/*
 * Barra de admin (M3) con el kit. Mismas reglas que AdminBar:
 *  - Solo admins, y nunca en la vista previa del mapa de calor (la página
 *    tiene que verse como la vio el visitante).
 *  - En la ficha de un producto: "Editar este producto" → su página del panel.
 *  - En el panel, el login y el registro: solo el acceso al panel.
 *  - En el resto: el panel y el editor visual. En las páginas que arma el
 *    builder (inicio, /tienda, marcas y landings) edita la página; en las
 *    demás (carrito, cuenta, Crear…) solo la cabecera, el pie y lo de toda la
 *    tienda. En la app nativa no se edita la página, así que ahí no sale.
 * Va pegada arriba y publica su alto (--admin-bar-height) para la cabecera.
 *
 * "Diseñar página" (Marcas, Landing Pages) lleva a la página con ?editar:
 * aquí se abre el editor y se quita el ?editar de la dirección.
 */
export default function BarraDeAdmin() {
  const { isAdmin } = useAuth();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { isEditModeActive, toggleEditMode, sinGuardar, paginaDelBuilder } = useVisualEditor();
  const confirmar = useConfirmar();
  const pideEditor = new URLSearchParams(search).has('editar');
  useEffect(() => {
    if (!pideEditor || !isAdmin) return;
    const resto = new URLSearchParams(search);
    resto.delete('editar');
    navigate(`${pathname}${resto.toString() ? `?${resto}` : ''}${hash}`, { replace: true });
    if (!isEditModeActive && !Capacitor.isNativePlatform() && !EN_VISTA_PREVIA_CALOR) toggleEditMode();
  }, [pideEditor, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  // Con el editor abierto el botón solo lo cierra (publicar es del panel):
  // "Salir del editor", y si hay cambios sin publicar, se pregunta antes.
  const alternarEditor = async () => {
    if (isEditModeActive && sinGuardar && !(await confirmar({ titulo: '¿Salir sin publicar?', texto: 'Los cambios que no publicaste se pierden.', confirmar: 'Salir', peligro: true }))) return;
    toggleEditMode();
  };

  if (!isAdmin || EN_VISTA_PREVIA_CALOR) return null;

  if (pathname.startsWith('/producto/')) {
    const id = pathname.split('/')[2];
    return <BarraAdmin fija editarEn={`/admin/productos/${id}`} textoEditor="Editar este producto" />;
  }

  if (['/admin', '/login', '/registro'].some((r) => pathname.startsWith(r))) {
    return <BarraAdmin fija />;
  }

  if (Capacitor.isNativePlatform()) return null;

  const texto = isEditModeActive ? 'Salir del editor' : paginaDelBuilder === null ? 'Editar cabecera y pie' : undefined;
  return <BarraAdmin fija editando={isEditModeActive} onEditor={alternarEditor} textoEditor={texto} />;
}
