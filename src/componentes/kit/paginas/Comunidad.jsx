import React, { useMemo, useState } from 'react';
import { Users, Shirt, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import { Chip } from '../Etiquetas';
import { Aviso, EstadoVacio } from '../Feedback';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoProducto } from '../Esqueletos';
import { CabezaCuenta } from '../piezas/Cuenta';
import { TarjetaCreacion } from '../piezas/Creaciones';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Texto, useTexto } from '../Traduccion';
import s from './Comunidad.module.css';

/*
 * Diseños de la comunidad (/comunidad): los que publica Walá para usarlos de
 * punto de partida. Se ve sin iniciar sesión (el estudio pide la sesión al
 * subir una imagen, guardar o comprar). Va dentro de MarcoTienda. Los textos
 * pasan por la traducción.
 */

/**
 * La galería de la comunidad.
 *  - disenos: [{ id, prendaId, prendaNombre, ...props de TarjetaCreacion con
 *    `usar` }] (disenoComunidadDesde; prendaId/prendaNombre para el filtro)
 *  - cargando · error · onReintentar · urlCrear ("Empezar desde cero")
 * Con más de una prenda, chips para filtrar ("Todas", "Polo clásico"…) con
 * cuántos diseños tiene cada una.
 */
export function PaginaComunidad({ disenos = [], cargando = false, error = false, onReintentar, urlCrear = '/personalizar' }) {
  const [prenda, setPrenda] = useState('');
  const prendas = useMemo(() => {
    const mapa = new Map();
    disenos.forEach((d) => {
      if (!d.prendaId) return;
      const actual = mapa.get(d.prendaId) || { nombre: d.prendaNombre || 'Prenda', n: 0 };
      mapa.set(d.prendaId, { ...actual, n: actual.n + 1 });
    });
    return [...mapa.entries()];
  }, [disenos]);
  const visibles = prenda ? disenos.filter((d) => d.prendaId === prenda) : disenos;
  const n = disenos.length;
  const t = {
    sub: useTexto(!cargando && n > 0 ? `${n} ${n === 1 ? 'diseño listo' : 'diseños listos'} para usar. Elige uno, cámbialo a tu gusto y hazlo tuyo.` : 'Elige uno, cámbialo a tu gusto y hazlo tuyo.'),
    filtrar: useTexto('Filtrar por prenda'),
    cargando: useTexto('Cargando diseños'),
  };

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaComunidad">
        <CabezaCuenta
          icono={<Users />}
          tono="rosa"
          titulo={<Texto>Diseños de la comunidad</Texto>}
          subtitulo={t.sub}
          accion={<Boton to={urlCrear} variante="contorno" icono={<Shirt aria-hidden="true" />}><Texto>Empezar desde cero</Texto></Boton>}
        />

        {!cargando && !error && prendas.length > 1 && (
          <div className={s.filtros} role="group" aria-label={t.filtrar}>
            <Chip activo={!prenda} cuenta={n} onClick={() => setPrenda('')}><Texto>Todas</Texto></Chip>
            {prendas.map(([id, { nombre, n: cuantos }]) => (
              <Chip key={id} activo={prenda === id} cuenta={cuantos} onClick={() => setPrenda(id)}><Texto>{nombre}</Texto></Chip>
            ))}
          </div>
        )}

        {cargando ? (
          <ul className={s.grilla} aria-busy="true" aria-label={t.cargando}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <li key={k}><EsqueletoProducto /></li>)}
          </ul>
        ) : error ? (
          <Aviso
            tipo="error"
            titulo="No pudimos cargar los diseños"
            accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}
          >
            Revisa tu conexión e inténtalo de nuevo.
          </Aviso>
        ) : visibles.length === 0 ? (
          <div className={s.vacio}>
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>Muy pronto</Texto>} texto={<Texto>Aquí verás diseños listos para usar. Mientras tanto, crea el tuyo desde cero.</Texto>}>
              <Boton to={urlCrear} icono={<Shirt aria-hidden="true" />}><Texto>Empezar a crear</Texto></Boton>
            </EstadoVacio>
          </div>
        ) : (
          <ul className={s.grilla} key={prenda || 'todas'}>
            {visibles.map(({ id, prendaId, prendaNombre, ...d }, k) => (
              <li key={id} style={{ '--k': k }}><TarjetaCreacion vertical {...d} /></li>
            ))}
          </ul>
        )}
      </div>
    </BloqueSeccion>
  );
}
