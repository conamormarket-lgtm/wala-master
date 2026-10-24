import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { fmtInt, fmtDuration } from '../dashboard/dashShared';
import { Tarjeta, Columnas, Barras, Cifras, Vacio } from './piezas';
import styles from './Visitantes.module.css';

/*
 * Visitantes: ¿quién viene y de dónde? Canal por canal, país, con qué entran
 * (celular, computadora, tablet) y si usan la app o la web. Del resumen diario.
 */

const DISPOSITIVOS = { Mobile: 'Celular', Desktop: 'Computadora', Tablet: 'Tablet', Desconocido: 'No se sabe' };
const CLIENTES = { APP: 'App Walá', WEB: 'Web (wala.pe)' };
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);
const porCien = (pedidos, visitas) => (visitas > 0 ? Math.round((pedidos / visitas) * 1000) / 10 : 0);

export default function Visitantes() {
  const { analitica } = useOutletContext();
  const { data, isLoading, error } = analitica;

  if (error) return <Vacio>No se pudieron cargar los datos: {error.message}</Vacio>;
  if (isLoading && !data) return <Vacio>Cargando…</Vacio>;

  const v = data?.visitas || {};
  const visitas = v.total?.total || 0;
  const canales = data?.canales || [];
  const conPorcentaje = (lista, nombres = {}) => {
    const suma = lista.reduce((s, x) => s + (Number(x.count) || 0), 0);
    return lista.map((x) => ({
      id: x.code || x.name,
      label: nombres[x.name] || (!x.name || /^(unknown|desconocido)$/i.test(x.name) ? 'No se sabe' : x.name),
      valor: x.count,
      texto: `${pct(x.count, suma)}%`,
      sub: `${fmtInt(x.count)} ${Number(x.count) === 1 ? 'visita' : 'visitas'}`,
    }));
  };
  const paises = conPorcentaje(data?.byCountry || []);
  const paisesAprox = conPorcentaje(data?.byCountryAprox || []);

  return (
    <div className={styles.pagina}>
      <Cifras items={[
        { label: 'Visitas', valor: fmtInt(visitas) },
        { label: 'Personas distintas', valor: data?.personas ? fmtInt(data.personas.total) : '—', sub: 'Mismo celular o computadora = 1' },
        { label: 'Hicieron algo', valor: `${pct(v.conInteraccion?.total || 0, visitas)}%`, sub: 'Vieron 2+ páginas, 10 s o pidieron' },
        { label: 'Páginas por visita', valor: visitas ? (v.paginas.total / visitas).toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—' },
        { label: 'Tiempo por visita', valor: visitas ? fmtDuration(Math.round(v.dwellMs.total / visitas)) : '—' },
      ]}
      />

      <Tarjeta
        id="canales"
        titulo="Canal por canal"
        ayuda='"Directo o sin dato": escribieron la dirección, usaron un favorito o vinieron de una app que no dice de dónde (Instagram y WhatsApp suelen ocultarlo). Comparte tus enlaces con ?utm_source=instagram para saberlo.'
      >
        {canales.length === 0 ? (
          <Vacio>Sin datos de origen en este periodo.</Vacio>
        ) : (
          <div className={styles.tablaScroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Visitas</th>
                  <th>Hicieron algo</th>
                  <th>Pedidos</th>
                  <th>De cada 100 compran</th>
                </tr>
              </thead>
              <tbody>
                {canales.map((c) => (
                  <tr key={c.canal}>
                    <td className={styles.canal}>{c.canal}</td>
                    <td>{fmtInt(c.visitas)} <span className={styles.parte}>{pct(c.visitas, visitas)}%</span></td>
                    <td>{pct(c.conInteraccion, c.visitas)}%</td>
                    <td>{fmtInt(c.pedidos)}</td>
                    <td>{porCien(c.pedidos, c.visitas).toLocaleString('es-PE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Columnas>
        <Tarjeta id="pais" titulo="País">
          {paises.length ? (
            <Barras filas={paises} />
          ) : paisesAprox.length ? (
            <>
              <p className={styles.nota}>Aproximado por la hora del dispositivo (días anteriores a medir el país).</p>
              <Barras filas={paisesAprox} />
            </>
          ) : (
            <Vacio>Sin datos de país en este periodo.</Vacio>
          )}
        </Tarjeta>
        <Tarjeta id="dispositivo" titulo="Con qué entran">
          <Barras filas={conPorcentaje(data?.byDevice || [], DISPOSITIVOS)} vacio="Sin datos de dispositivo en este periodo." />
          <Barras filas={conPorcentaje(data?.byClientType || [], CLIENTES)} vacio="Sin datos de app o web en este periodo." />
        </Tarjeta>
      </Columnas>
    </div>
  );
}
