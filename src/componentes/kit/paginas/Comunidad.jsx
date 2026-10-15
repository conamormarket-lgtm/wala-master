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
import s from './Comunidad.module.css';

/*
 * Diseños de la comunidad (/comunidad): los que publica Walá para usarlos de
 * punto de partida. Se ve sin iniciar sesión (el estudio pide la sesión al
 * subir una imagen, guardar o comprar). Va dentro de MarcoTienda.
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

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaComunidad">
        <CabezaCuenta
          icono={<Users />}
          tono="rosa"
          titulo="Diseños de la comunidad"
          subtitulo={!cargando && n > 0 ? `${n} ${n === 1 ? 'diseño listo' : 'diseños listos'} para usar. Elige uno, cámbialo a tu gusto y hazlo tuyo.` : 'Elige uno, cámbialo a tu gusto y hazlo tuyo.'}
          accion={<Boton to={urlCrear} variante="contorno" icono={<Shirt aria-hidden="true" />}>Empezar desde cero</Boton>}
        />

        {!cargando && !error && prendas.length > 1 && (
          <div className={s.filtros} role="group" aria-label="Filtrar por prenda">
            <Chip activo={!prenda} cuenta={n} onClick={() => setPrenda('')}>Todas</Chip>
            {prendas.map(([id, { nombre, n: cuantos }]) => (
              <Chip key={id} activo={prenda === id} cuenta={cuantos} onClick={() => setPrenda(id)}>{nombre}</Chip>
            ))}
          </div>
        )}

        {cargando ? (
          <ul className={s.grilla} aria-busy="true" aria-label="Cargando diseños">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <li key={k}><EsqueletoProducto /></li>)}
          </ul>
        ) : error ? (
          <Aviso
            tipo="error"
            titulo="No pudimos cargar los diseños"
            accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}
          >
            Revisa tu conexión e inténtalo de nuevo.
          </Aviso>
        ) : visibles.length === 0 ? (
          <div className={s.vacio}>
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Muy pronto" texto="Aquí verás diseños listos para usar. Mientras tanto, crea el tuyo desde cero.">
              <Boton to={urlCrear} icono={<Shirt aria-hidden="true" />}>Empezar a crear</Boton>
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
