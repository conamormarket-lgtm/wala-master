import React from 'react';
import { Store, Brush, Download, Smartphone, Globe } from 'lucide-react';
import Boton from '../Boton';
import { Buscador } from '../Formulario';
import { Cargando } from '../Cargando';
import { Trazo, Sello, Puntos, Destello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Texto } from '../Traduccion';
import s from './Generales.module.css';

/*
 * Páginas generales de la tienda: la de una dirección que no existe y la de
 * descargar la app (/descargar y /app). En la tienda desde el 2026-10-20
 * (components/generales/, ver guia/GENERALES.md).
 * No cargan datos: no tienen esqueleto propio (EsqueletoPagina forma="aviso"
 * sirve si la tienda tarda en decidir a dónde va). Los textos pasan por la
 * traducción (la dirección pedida, no).
 */

/** Los adornos quietos de la tarjeta (puntos y destellos). */
function Adornos() {
  return (
    <span className={s.adornos} aria-hidden="true">
      <Puntos className={s.puntos} />
      <Destello className={s.destello1} />
      <Destello className={s.destello2} />
    </span>
  );
}

/* ── No encontrada ─────────────────────────────────────── */

/**
 * Una dirección que no existe: Kapi triste, qué pasó, la dirección que se
 * pidió, un buscador y los dos caminos de siempre (la tienda y Crear). En vez
 * de mandar al inicio sin avisar, como hoy.
 *  - ruta: la dirección que no existe ("/poleras-anime")
 *  - onBuscar(texto): lleva a /buscar?q=…
 *  - urlTienda · urlCrear
 */
export function PaginaNoEncontrada({ ruta, onBuscar, urlTienda = '/tienda', urlCrear = '/personalizar' }) {
  // El Buscador traduce su marcador y su botón (un Boton) traduce "Buscar".
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <section className={s.tarjeta} data-componente="PaginaNoEncontrada">
        <Adornos />
        <img src={CARAS_KAPI.triste} alt="" width="132" height="132" className={s.kapi} />
        <span className={s.sello}>404</span>
        <h1 className={s.titulo}><Texto>No encontramos esta página</Texto><Trazo className={s.trazo} /></h1>
        <p className={s.texto}><Texto>Puede que el link esté incompleto o que la página ya no exista.</Texto></p>
        {ruta && <code className={s.ruta}>{ruta}</code>}
        {onBuscar && (
          <div className={s.buscador}>
            <Buscador grande placeholder="Busca un producto" onBuscar={onBuscar} boton="Buscar" atajo={null} />
          </div>
        )}
        <div className={s.botones}>
          <Boton to={urlTienda} tamano="lg" icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
          <Boton to={urlCrear} tamano="lg" variante="secundario" icono={<Brush aria-hidden="true" />}><Texto>Crear mi diseño</Texto></Boton>
        </div>
      </section>
    </BloqueSeccion>
  );
}

/* ── Descargar la app (/descargar, /app) ─────────────────── */

/**
 * Descargar la app de Walá (solo hay para Android). En Android abre la Play
 * Store sola y deja el botón por si no se abrió; en un iPhone o en la
 * computadora no manda a la Play Store (no sirve ahí): dice que la app es
 * para Android y deja seguir en la web.
 *  - plataforma: 'android' | 'iphone' | 'computadora' (la tienda la saca del
 *    navegador)
 *  - urlPlayStore · urlTienda · urlCorta ("wala.pe/descargar", para abrir
 *    desde el celular)
 */
export function PaginaDescargarApp({
  plataforma = 'android', urlPlayStore = 'https://play.google.com/store/apps/details?id=com.wala.tienda',
  urlTienda = '/tienda', urlCorta = 'wala.pe/descargar',
}) {
  const android = plataforma === 'android';
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <section className={s.tarjeta} data-componente="PaginaDescargarApp">
        <Adornos />
        <Sello tamano={76} girar={-8}><Smartphone aria-hidden="true" className={s.selloIcono} /></Sello>
        {android ? (
          <>
            <h1 className={s.titulo}><Texto>Abriendo la Play Store</Texto><Trazo className={s.trazo} /></h1>
            <Cargando texto={null} tamano="sm" />
            <p className={s.texto}><Texto>Si no se abre sola en unos segundos, toca el botón.</Texto></p>
            <div className={s.botones}>
              <Boton to={urlPlayStore} tamano="lg" icono={<Download aria-hidden="true" />}><Texto>Abrir la Play Store</Texto></Boton>
              <Boton to={urlTienda} tamano="lg" variante="fantasma" icono={<Globe aria-hidden="true" />}><Texto>Seguir en la web</Texto></Boton>
            </div>
          </>
        ) : (
          <>
            <h1 className={s.titulo}><Texto>La app de Walá es para Android</Texto><Trazo className={s.trazo} /></h1>
            <p className={s.texto}>
              <Texto>{plataforma === 'iphone'
                ? 'Desde tu iPhone puedes comprar, crear tu diseño y ver tus pedidos aquí, en la web.'
                : 'Desde la computadora puedes comprar y crear tu diseño aquí, en la web. Para la app, abre este link en tu celular Android:'}</Texto>
            </p>
            {plataforma !== 'iphone' && <code className={s.ruta}>{urlCorta}</code>}
            <div className={s.botones}>
              <Boton to={urlTienda} tamano="lg" icono={<Globe aria-hidden="true" />}><Texto>Seguir en la web</Texto></Boton>
            </div>
          </>
        )}
      </section>
    </BloqueSeccion>
  );
}
