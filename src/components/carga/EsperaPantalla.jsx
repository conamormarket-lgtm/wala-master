import React from 'react';
import { createPortal } from 'react-dom';
import useLoViejo from '../../hooks/useLoViejo';
import Loading from '../common/Loading';
import { CapaCargando } from '../../componentes/kit/Cargando';

/*
 * Esperar una acción a pantalla completa (iniciar sesión, crear la cuenta,
 * mandar el enlace para la contraseña): CapaCargando del kit (paso 7,
 * CARGA.md), en <body> como el círculo de antes para que nada de la página la
 * recorte. Con el interruptor cargaVieja, el círculo de antes.
 *  - texto: "Iniciando sesión..."
 */
export default function EsperaPantalla({ texto }) {
  const cargaVieja = useLoViejo('carga');
  // Los puntos los pone Cargando (animados): sin los del texto. CapaCargando lo traduce.
  const limpio = String(texto || 'Procesando').replace(/(\.+|…)$/, '');
  if (cargaVieja) return <Loading fullScreen portal message={texto} />;
  return createPortal(<CapaCargando pantallaCompleta texto={limpio} />, document.body);
}
