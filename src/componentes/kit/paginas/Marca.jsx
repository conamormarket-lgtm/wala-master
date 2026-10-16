import React from 'react';
import { RotateCcw, Store } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { tarjetaDesdeProducto, identidadDeMarca, plantillaDeMarca, ESQUELETO_MARCA } from '../adaptadores';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PortadaMarca } from '../piezas/PortadaMarca';
import { PaginaTienda } from './Paginas';
import s from './Marca.module.css';

/*
 * La página de una marca (/:slug con brandId) sin armarla a mano: su
 * identidad (color, portada, frase) y la plantilla de siempre (burbujas, lo
 * más pedido, ofertas y catálogo), con las mismas secciones del builder.
 * Si la marca tiene secciones propias (una landing armada en el builder),
 * mandan esas; la portada sale si no traen su propio banner. Todo va dentro
 * de TemaMarca: los acentos con el color de la marca, los botones de compra
 * siguen violeta. Es PaginaTienda con su portada y su tema.
 */

const BANNERS = ['hero_banner', 'hero_carousel'];

/**
 * La página.
 *  - marca: el doc de tienda_brands ({ id, name, logoUrl, identidad… })
 *  - identidad: { color, color2, estilo, imagen, frase, bloques } (si no,
 *    identidadDeMarca(marca))
 *  - secciones: las de pages/{slug} si la landing se armó en el builder
 *    (vacías o sin pasar: la plantilla)
 *  - productos: { destacados, ofertas, todos, porCategoria } de la marca
 *  - estado: 'cargando' | 'error' (onReintentar) · urlTienda
 *  - El resto: los de PaginaTienda (marco, categorias, marcas, navPorMarca,
 *    propsPara, onAgregar, envolver…)
 */
export function PaginaMarca({ marca = {}, identidad, secciones, productos = {}, estado, onReintentar, urlTienda = '/tienda', ...resto }) {
  const id = identidad || identidadDeMarca(marca);
  const propias = Array.isArray(secciones) && secciones.length > 0;
  const todos = productos.todos || [];

  if (estado === 'cargando') {
    // La misma forma que la plantilla: portada, burbujas, una fila y el catálogo.
    return <PaginaTienda {...resto} secciones={[]} kapiEnPie={false} antes={<EsqueletoPagina secciones={ESQUELETO_MARCA} />} />;
  }
  if (estado === 'error' || !todos.length) {
    const error = estado === 'error';
    return (
      <PaginaTienda
        {...resto}
        secciones={[]}
        kapiEnPie={false}
        antes={(
          <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
            <div className={s.vacio}>
              <EstadoVacio
                imagen={CARAS_KAPI.triste}
                titulo={error ? 'No pudimos cargar esta marca' : `${marca.name || 'Esta marca'} aún no tiene productos`}
                texto={error ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Pronto llegan. Mientras, mira lo que hay en la tienda.'}
              >
                {error
                  ? <Boton icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>
                  : <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>}
              </EstadoVacio>
            </div>
          </BloqueSeccion>
        )}
      />
    );
  }

  const lista = propias ? secciones : plantillaDeMarca({
    brandId: marca.id, nombre: marca.name, bloques: id.bloques,
    hayDestacados: (productos.destacados || []).length > 0, hayOfertas: (productos.ofertas || []).length > 0,
  });
  const conPortada = !lista.some((sec) => BANNERS.includes(sec.type));
  // El collage: lo más pedido (o lo primero del catálogo) que tenga foto (los combos no traen).
  const conFoto = (lista) => [...new Set(lista.map((p) => tarjetaDesdeProducto(p).imagen).filter(Boolean))];
  const fotos = [...new Set([...conFoto(productos.destacados || []), ...conFoto(todos)])].slice(0, 3);

  return (
    <PaginaTienda
      {...resto}
      productos={productos}
      marcaActual={marca.id}
      secciones={lista}
      tema={id}
      antes={conPortada && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '0.25rem' }}>
          <PortadaMarca
            nombre={marca.name}
            logo={marca.logoUrl}
            frase={id.frase}
            estilo={id.estilo}
            imagen={id.imagen}
            fotos={fotos}
            cuenta={todos.length}
          />
        </BloqueSeccion>
      )}
    />
  );
}
