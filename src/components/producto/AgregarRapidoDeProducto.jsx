import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import AgregarRapido from '../../componentes/kit/AgregarRapido';
import { opcionesDeProducto } from '../../componentes/kit/adaptadores';
import usePiezasDelCombo from './usePiezasDelCombo';
import { argumentosDelCarrito, rutaDelEditor } from './eleccionCarrito';
import useLoViejo from '../../hooks/useLoViejo';

/**
 * "Agregar rápido" de una tarjeta (paso 6 de la migración): elegir color,
 * talla y cantidad sin salir de la lista. Antes, "Elegir" llevaba a la ficha.
 * Lo mismo que agrega la ficha (eleccionCarrito.js); el toast lo pone
 * CartContext. Las prendas de un combo se piden al abrir.
 * Baja aparte (lazy en TarjetaDeProducto), solo la primera vez que se abre.
 *  - product · abierto · onCerrar
 */
export default function AgregarRapidoDeProducto({ product, abierto, onCerrar }) {
  const navigate = useNavigate();
  const personalizableViejo = useLoViejo('personalizable');
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const { porIndice, porId, listas, terminado } = usePiezasDelCombo(product, abierto);

  const opciones = useMemo(() => {
    const o = opcionesDeProducto(product, { subproductos: porId });
    // Las fotos de la hoja son chicas: la miniatura, no la original.
    return {
      ...o,
      producto: { ...o.producto, imagen: toThumbnailImageUrl(o.producto.imagen || '') || o.producto.imagen },
      variantes: o.variantes.map((v) => ({ ...v, imagen: v.imagen ? toThumbnailImageUrl(v.imagen) || v.imagen : v.imagen })),
    };
  }, [product, porId]);
  const principal = (product?.variants || []).find((v) => String(v.id) === String(product.defaultVariantId));

  const alConfirmar = (eleccion) => {
    if (!listas) {
      if (terminado) toast.error('No pudimos cargar las prendas del combo. Recarga la página e inténtalo de nuevo.');
      else toast.info('Un momento: estamos cargando las prendas del combo.');
      return;
    }
    const { variant, cantidad, combo } = argumentosDelCarrito(product, eleccion, porIndice);
    addToCart(product, variant, null, cantidad, combo);
    onCerrar?.();
  };

  return (
    <AgregarRapido
      abierto={abierto}
      onCerrar={onCerrar}
      {...opciones}
      varianteInicial={principal?.id}
      cargando={!terminado}
      // Ya no se personaliza (salvo con personalizableViejo): Yoryo se abría
      // desde la ficha; el editor, directo con lo elegido.
      personalizable={personalizableViejo && Boolean(product?.customizable || product?.YoryoPersonalizado)}
      onPersonalizar={(eleccion) => {
        onCerrar?.();
        navigate(product.YoryoPersonalizado ? `/producto/${product.id}` : rutaDelEditor(product, eleccion, porIndice));
      }}
      onConfirmar={alConfirmar}
    />
  );
}
