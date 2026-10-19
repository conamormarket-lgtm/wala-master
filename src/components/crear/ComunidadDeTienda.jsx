import React from 'react';
import { useComunidad } from '../../pages/Comunidad/useComunidad';
import { PaginaComunidad } from '../../componentes/kit/paginas/Comunidad';
import { disenoComunidadDesde } from '../../componentes/kit/adaptadoresCrear';

/*
 * Diseños de la comunidad (/comunidad) con el kit (paso 6, CREAR.md P8). Lo
 * mismo que ComunidadPage: la galería pública (useComunidad, se vuelve a
 * pedir al mostrarse), el filtro por prenda (con más de una), "Reintentar" si
 * falla y "Empezar desde cero" a Crear. "Usar diseño" abre el estudio (o el
 * combo) con la plantilla.
 * Lo de antes: pages/Comunidad/ComunidadViejo.jsx (interruptor crearViejo).
 */
export default function ComunidadDeTienda() {
  const q = useComunidad();
  return (
    <PaginaComunidad
      disenos={(q.data || []).map(disenoComunidadDesde)}
      cargando={q.isLoading}
      error={q.isError}
      onReintentar={() => q.refetch()}
      urlCrear="/personalizar"
    />
  );
}
