import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getPrendasBase } from '../../services/prendasBase';
import { crearProductosYoryo, pasarYoryoALaTienda, ajustarTomatodoAFotoNueva, IDS_CREAR_YORYO } from '../../pages/admin/plantillasYoryo/crearProductosYoryo';
import { crearGrabadosYoryo } from '../../pages/admin/plantillasYoryo/grabadosYoryo';
import { crearComodasDaida } from '../../pages/admin/plantillasYoryo/comodasDaida';
import { PRODUCTOS, plantillasDe, leerEditadas, importar, limpiar } from '../../pages/admin/plantillasYoryo/pasosYoryo';
import { PaginaPlantillasYoryo } from '../../componentes/kit/paginas/admin/Herramientas';
import { useLectura, useInvalidar } from './comun';

/*
 * /admin/plantillas-yoryo (D2d): PaginaPlantillasYoryo con los mismos pasos
 * de ImportarPlantillasYoryo (crearProductosYoryo, pasosYoryo, grabadosYoryo,
 * comodasDaida…) y las mismas invalidaciones de cada paso. Cada paso
 * devuelve su último aviso como resultado; si falla, el kit muestra el error.
 */

const prendasConBorradores = () => getPrendasBase({ incluirBorradores: true });

// Los productos y sus plantillas no cambian: se arman una vez.
const PRODUCTOS_KIT = PRODUCTOS.map(([id, nombre]) => ({ id, nombre }));
const PLANTILLAS_KIT = Object.fromEntries(PRODUCTOS.map(([p]) => [p, plantillasDe(p).map(({ id, grupo, nombre }) => ({ id, grupo, nombre }))]));

/** Corre un paso de antes con su onPaso → avisar, y devuelve el último aviso. */
const conAvisos = (paso) => async (avisar) => {
  let ultimo = '';
  await paso({ onPaso: (t) => { ultimo = t; avisar(t); } });
  return ultimo;
};

export default function PlantillasYoryoDelPanel() {
  const { user } = useAuth();
  const prendas = useLectura(['admin-prendas-crear-importar'], prendasConBorradores);
  // Las ediciones de templates/yoryo-composiciones-v4 mandan (como hoy).
  const editadas = useQuery({ queryKey: ['plantillas-yoryo-editadas'], queryFn: leerEditadas });
  const invalidar = useInvalidar();

  const lista = useMemo(() => prendas.datos || [], [prendas.datos]);
  // Los destinos posibles: las que tienen vistas (como el select de antes).
  const opciones = useMemo(() => lista.filter((p) => p.prendaBase?.vistas?.length)
    .map((p) => ({ id: p.id, nombre: p.name, borrador: p.visible === false })), [lista]);
  // Si ya existen los productos de Crear, se eligen solos.
  const destinosIniciales = useMemo(() => Object.fromEntries(PRODUCTOS
    .filter(([p]) => lista.some((x) => x.id === IDS_CREAR_YORYO[p]))
    .map(([p]) => [p, IDS_CREAR_YORYO[p]])), [lista]);

  return (
    <PaginaPlantillasYoryo
      productos={PRODUCTOS_KIT}
      prendas={opciones}
      destinosIniciales={destinosIniciales}
      plantillas={PLANTILLAS_KIT}
      cargando={prendas.cargando || editadas.isLoading}
      sinSesion={!user}
      // 1. Productos y pack; vuelve a leer las prendas para los destinos.
      onCrearProductos={async (avisar) => {
        const texto = await conAvisos(crearProductosYoryo)(avisar);
        await invalidar(['admin-prendas-crear-importar'], ['prendas-base']);
        return texto;
      }}
      // 2. Las plantillas: el estado de cada una a su lado; a medias si alguna falló.
      onGuardarPlantillas={async ({ destinos, elegidas }, marcar) => {
        const final = {};
        await importar({
          destino: destinos,
          elegidas,
          prendas: lista,
          editadas: editadas.data,
          marcar: (id, texto) => {
            const corto = texto === 'Guardada en el producto' ? 'Guardada' : texto;
            final[id] = corto;
            marcar(id, corto);
          },
        });
        await invalidar(['prendas-base']);
        const estados = Object.values(final);
        const guardadas = estados.filter((t) => t === 'Guardada').length;
        const errores = estados.filter((t) => t.startsWith('Error')).length;
        if (!estados.length) return { texto: 'No había plantillas elegidas en esos productos.', aviso: true };
        return errores
          ? { texto: `${guardadas} guardadas; ${errores} con error (míralas en la lista).`, aviso: true }
          : `${guardadas} plantillas guardadas en sus productos.`;
      }}
      // 3. Las copias de la comunidad, con la cuenta de esta sesión.
      onQuitarCopias={async (avisar) => {
        const texto = await limpiar(user.uid, avisar);
        await invalidar(['comunidad'], ['mis-creaciones-crear'], ['mis-borradores-crear']);
        return texto;
      }}
      onPasarATienda={async (avisar) => {
        const texto = await conAvisos(pasarYoryoALaTienda)(avisar);
        await invalidar(['products'], ['admin-products'], ['prendas-base']);
        return texto;
      }}
      onAjustarTomatodo={async (avisar) => {
        const texto = await conAvisos(ajustarTomatodoAFotoNueva)(avisar);
        await invalidar(['prenda-base'], ['prendas-base']);
        return texto;
      }}
      onCrearGrabados={async (avisar) => {
        const texto = await conAvisos(crearGrabadosYoryo)(avisar);
        await invalidar(['prendas-base'], ['prenda-base'], ['admin-products'], ['admin-combos-crear'], ['products']);
        return texto;
      }}
      onCrearComodas={async (avisar) => {
        const texto = await conAvisos(crearComodasDaida)(avisar);
        await invalidar(['admin-products'], ['products'], ['categories']);
        return texto;
      }}
    />
  );
}
