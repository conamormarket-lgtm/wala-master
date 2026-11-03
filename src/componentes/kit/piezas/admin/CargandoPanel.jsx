import React from 'react';
import { IsoWala } from '../../Marca';
import { Hueso, EsqueletoCabeza, EsqueletoFila } from '../../Esqueletos';
import s from './CargandoPanel.module.css';

/*
 * El panel mientras carga. Va aparte del marco (Marco.jsx) porque lo usa
 * también la tienda (AdminRoute y el fallback de las rutas): así no arrastra
 * el menú del admin al paquete de la tienda. La silueta copia la del marco:
 * menú al costado desde 960 px, cabecera arriba en el celular.
 */

const cx = (...c) => c.filter(Boolean).join(' ');

/**
 * Una página del panel mientras baja su código: el sello y el título, la
 * barra de buscar y seis filas. Va dentro del marco (el menú sigue a mano).
 */
export function EsqueletoPaginaAdmin() {
  return (
    <div className={s.pagina} role="status" aria-label="Cargando" data-componente="EsqueletoPaginaAdmin">
      <div className={s.cabeza}>
        <Hueso forma="circulo" ancho={44} alto={44} />
        <EsqueletoCabeza />
      </div>
      <Hueso forma="pildora" alto={44} ancho="min(100%, 440px)" />
      <div className={s.filas}>
        {[0, 1, 2, 3, 4, 5].map((k) => <EsqueletoFila key={k} foto="circulo" />)}
      </div>
    </div>
  );
}

/**
 * El panel entero mientras se confirma quién entra o baja el marco: la
 * silueta del menú (computadora) o de la cabecera (celular) con la página en
 * hueso. Tapa la cabecera y el pie de la tienda, que todavía están puestos.
 *  - fijo: por encima de todo (por defecto); false, en su lugar (la demo)
 */
export function CargandoPanel({ fijo = true }) {
  return (
    <div className={cx(s.marco, fijo && s.fijo)} data-componente="CargandoPanel">
      <div className={s.rejilla}>
        <aside className={s.lateral} aria-hidden="true">
          <span className={s.marca}>
            <IsoWala tamano={34} />
            <span className={s.marcaTextos}>
              <strong>Walá</strong>
              <span>Panel</span>
            </span>
          </span>
          <Hueso forma="pildora" alto={40} />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <span key={k} className={s.item}>
              <Hueso forma="circulo" ancho={28} alto={28} />
              <Hueso alto={12} ancho={`${55 + ((k * 13) % 30)}%`} />
            </span>
          ))}
        </aside>
        <div className={s.columna}>
          <header className={s.cabeceraMovil} aria-hidden="true">
            <IsoWala tamano={30} />
            <span className={s.marcaTextos}>
              <strong>Walá</strong>
              <span>Panel</span>
            </span>
          </header>
          <main className={s.contenido}>
            <EsqueletoPaginaAdmin />
          </main>
        </div>
      </div>
    </div>
  );
}
