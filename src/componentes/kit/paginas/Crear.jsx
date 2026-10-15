import React from 'react';
import Boton from '../Boton';
import Carrusel from '../Carrusel';
import { EstadoVacio } from '../Feedback';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoProducto } from '../Esqueletos';
import { TarjetaCreacion } from '../piezas/Creaciones';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PortadaCrear, TarjetaPrendaBase, TarjetaComboCrear, ElegirPara, textoPara } from '../piezas/Crear';
import s from './Crear.module.css';

/*
 * Crear (/personalizar): la portada con los pasos, lo del cliente (sus
 * borradores y sus creaciones), los diseños de la comunidad para empezar
 * desde uno ya hecho y "Empieza una nueva": ¿para cuántos? y las prendas (o
 * los combos) para diseñar. Va dentro de MarcoTienda. Datos por props
 * (prendaCrearDesdeProducto, comboCrearDesde… en adaptadores).
 */

const VISIBLES = { escritorio: 4, tablet: 2.5, movil: 1.35 };

/** Una fila de tarjetas con su título y "Ver todas (N)". */
function Fila({ titulo, subtitulo, accion, etiqueta, children }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
      <div className={s.fila} data-componente="FilaCrear">
        <TituloSeccion titulo={titulo} subtitulo={subtitulo} accion={accion} />
        <Carrusel visibles={VISIBLES} flechas etiqueta={etiqueta}>{children}</Carrusel>
      </div>
    </BloqueSeccion>
  );
}

/**
 * La página Crear.
 *  - prendas: [{ id, ...props de TarjetaPrendaBase }] · cargando
 *  - combos: [{ id, piezas: n, conjunto, ...props de TarjetaComboCrear }]
 *  - para · onPara(n): "¿Para cuántos?" (en la tienda va en la dirección: ?para=2)
 *  - borradores, creaciones: [{ id, ...props de TarjetaCreacion }] (las 8
 *    más recientes) · totalCreaciones: para "Ver todas (13)"
 *  - comunidad: [{ id, ...props de TarjetaCreacion con `usar` }] · totalComunidad
 *  - urlCreaciones, urlComunidad, urlTienda · portada: props de PortadaCrear
 */
export function PaginaCrear({
  prendas = [], combos = [], cargando = false, para = 1, onPara,
  borradores = [], creaciones = [], totalCreaciones, comunidad = [], totalComunidad,
  urlCreaciones = '/cuenta/creaciones', urlComunidad = '/comunidad', urlTienda = '/tienda', portada,
}) {
  // 1 son las prendas sueltas; 2, 3… los tamaños de combo que hay.
  const tamanos = [...new Set(combos.map((c) => c.piezas))].sort((a, b) => a - b);
  const opciones = [1, ...tamanos].map((n) => {
    const deN = combos.filter((c) => c.piezas === n);
    const conjunto = n > 1 && deN.length > 0 && deN.every((c) => c.conjunto);
    return { valor: n, texto: textoPara(n, conjunto), grupo: n > 1 && !conjunto };
  });
  const elegido = opciones.some((o) => o.valor === para) ? para : 1;
  const combosDePara = combos.filter((c) => c.piezas === elegido);
  const hayAlgoArriba = borradores.length > 0 || creaciones.length > 0 || comunidad.length > 0;
  const nCreaciones = totalCreaciones ?? creaciones.length;
  const nComunidad = totalComunidad ?? comunidad.length;

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '0.75rem' }}>
        <PortadaCrear {...portada} />
      </BloqueSeccion>

      {borradores.length > 0 && (
        <Fila titulo="Tus borradores" subtitulo="Diseños sin terminar. Continúa donde lo dejaste." etiqueta="Tus borradores">
          {borradores.map(({ id, ...b }) => <TarjetaCreacion key={id} borrador vertical {...b} />)}
        </Fila>
      )}

      {creaciones.length > 0 && (
        <Fila
          titulo="Tus creaciones"
          subtitulo="Listas para comprar o seguir editando."
          accion={{ texto: `Ver todas${nCreaciones > 1 ? ` (${nCreaciones})` : ''}`, url: urlCreaciones }}
          etiqueta="Tus creaciones"
        >
          {creaciones.map(({ id, ...c }) => <TarjetaCreacion key={id} vertical {...c} />)}
        </Fila>
      )}

      {comunidad.length > 0 && (
        <Fila
          titulo="Diseños de la comunidad"
          subtitulo="Elige uno y hazlo tuyo."
          accion={{ texto: `Ver todos${nComunidad > 1 ? ` (${nComunidad})` : ''}`, url: urlComunidad }}
          etiqueta="Diseños de la comunidad"
        >
          {comunidad.map(({ id, ...d }) => <TarjetaCreacion key={id} vertical {...d} />)}
        </Fila>
      )}

      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <div className={s.nueva} data-componente="EmpiezaNueva">
          {(hayAlgoArriba || opciones.length > 1) && (
            <TituloSeccion
              titulo="Empieza una nueva"
              subtitulo={elegido === 1 ? 'Elige la prenda que quieres diseñar.' : 'Cada prenda con su propio diseño, color y talla, a precio de combo.'}
              subrayado
            />
          )}
          {opciones.length > 1 && <ElegirPara opciones={opciones} valor={elegido} onCambiar={onPara} />}

          {elegido > 1 ? (
            <ul className={s.grilla} key={`para-${elegido}`}>
              {combosDePara.map(({ id, piezas, conjunto, ...c }, k) => <li key={id} style={{ '--k': k }}><TarjetaComboCrear {...c} /></li>)}
            </ul>
          ) : cargando ? (
            <ul className={s.grilla} aria-busy="true">
              {[0, 1, 2, 3].map((k) => <li key={k}><EsqueletoProducto /></li>)}
            </ul>
          ) : prendas.length > 0 ? (
            <ul className={s.grilla} key="para-1">
              {prendas.map(({ id, ...p }, k) => <li key={id} style={{ '--k': k }}><TarjetaPrendaBase {...p} /></li>)}
            </ul>
          ) : (
            <div className={s.vacio}>
              <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Muy pronto" texto="Estamos preparando las prendas que podrás diseñar. Mientras tanto, mira lo que tenemos en la tienda.">
                <Boton to={urlTienda}>Ir a la tienda</Boton>
              </EstadoVacio>
            </div>
          )}
        </div>
      </BloqueSeccion>
    </>
  );
}
