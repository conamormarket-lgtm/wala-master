import React from 'react';
import { User, Users } from 'lucide-react';
import Boton from '../Boton';
import Carrusel from '../Carrusel';
import TarjetaProducto from '../TarjetaProducto';
import { Chip } from '../Etiquetas';
import { EstadoVacio } from '../Feedback';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoProducto } from '../Esqueletos';
import { TarjetaCreacion } from '../piezas/Creaciones';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PortadaCrear, textoPara } from '../piezas/Crear';
import { Texto, useTexto } from '../Traduccion';
import s from './Crear.module.css';

/*
 * Crear (/personalizar): la portada con los pasos, lo del cliente (sus
 * borradores y sus creaciones), los diseños de la comunidad para empezar
 * desde uno ya hecho y "Empieza una nueva": ¿para cuántos? y las prendas (o
 * los combos) para diseñar. Va dentro de MarcoTienda. Datos por props
 * (prendaCrearDesdeProducto, comboCrearDesde… en adaptadoresCrear.js). Los
 * textos pasan por la traducción.
 */

const VISIBLES = { escritorio: 4, tablet: 2.5, movil: 1.35 };

/** Una fila de tarjetas con su título y "Ver todas (N)". */
function Fila({ titulo, subtitulo, accion, etiqueta: etiquetaOriginal, children }) {
  const etiqueta = useTexto(etiquetaOriginal);
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
 *  - prendas: [{ id, ...props de TarjetaProducto }] (accion "crear") · cargando
 *  - combos: [{ id, cantidad: n, conjunto, ...props de TarjetaProducto con piezas }]
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
  const tamanos = [...new Set(combos.map((c) => c.cantidad))].sort((a, b) => a - b);
  const opciones = [1, ...tamanos].map((n) => {
    const deN = combos.filter((c) => c.cantidad === n);
    const conjunto = n > 1 && deN.length > 0 && deN.every((c) => c.conjunto);
    return { valor: n, texto: textoPara(n, conjunto), grupo: n > 1 && !conjunto };
  });
  const elegido = opciones.some((o) => o.valor === para) ? para : 1;
  const combosDePara = combos.filter((c) => c.cantidad === elegido);
  const hayAlgoArriba = borradores.length > 0 || creaciones.length > 0 || comunidad.length > 0;
  const nCreaciones = totalCreaciones ?? creaciones.length;
  const nComunidad = totalComunidad ?? comunidad.length;
  const t = {
    verTodas: useTexto(`Ver todas${nCreaciones > 1 ? ` (${nCreaciones})` : ''}`),
    verTodos: useTexto(`Ver todos${nComunidad > 1 ? ` (${nComunidad})` : ''}`),
    para: useTexto('¿Para cuántas personas?'),
  };

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
          accion={{ texto: t.verTodas, url: urlCreaciones }}
          etiqueta="Tus creaciones"
        >
          {creaciones.map(({ id, ...c }) => <TarjetaCreacion key={id} vertical {...c} />)}
        </Fila>
      )}

      {comunidad.length > 0 && (
        <Fila
          titulo="Diseños de la comunidad"
          subtitulo="Elige uno y hazlo tuyo."
          accion={{ texto: t.verTodos, url: urlComunidad }}
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
          {opciones.length > 1 && (
            <div className={s.para} role="group" aria-label={t.para}>
              {opciones.map((o) => (
                <Chip key={o.valor} activo={o.valor === elegido} icono={o.grupo ? <Users aria-hidden="true" /> : <User aria-hidden="true" />} onClick={() => onPara?.(o.valor)}>
                  <Texto>{o.texto}</Texto>
                </Chip>
              ))}
            </div>
          )}

          {elegido > 1 ? (
            <ul className={s.grilla} key={`para-${elegido}`}>
              {combosDePara.map(({ id, cantidad, conjunto, ...c }, k) => <li key={id} style={{ '--k': k }}><TarjetaProducto {...c} /></li>)}
            </ul>
          ) : cargando ? (
            <ul className={s.grilla} aria-busy="true">
              {[0, 1, 2, 3].map((k) => <li key={k}><EsqueletoProducto /></li>)}
            </ul>
          ) : prendas.length > 0 ? (
            <ul className={s.grilla} key="para-1">
              {prendas.map(({ id, ...p }, k) => <li key={id} style={{ '--k': k }}><TarjetaProducto {...p} /></li>)}
            </ul>
          ) : (
            <div className={s.vacio}>
              <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>Muy pronto</Texto>} texto={<Texto>Estamos preparando las prendas que podrás diseñar. Mientras tanto, mira lo que tenemos en la tienda.</Texto>}>
                <Boton to={urlTienda}><Texto>Ir a la tienda</Texto></Boton>
              </EstadoVacio>
            </div>
          )}
        </div>
      </BloqueSeccion>
    </>
  );
}
