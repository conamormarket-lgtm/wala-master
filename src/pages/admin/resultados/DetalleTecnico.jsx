import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { rebuildHistoricalAnalyticsSummary } from '../../../services/adminAnalyticsBackfill';
import BackfillAnaliticaButton from '../dashboard/BackfillAnaliticaButton';
import { fmtInt } from '../dashboard/dashShared';
import { Tarjeta, Columnas, Vacio } from './piezas';
import styles from './DetalleTecnico.module.css';

/*
 * Detalle técnico (solo admin): lo que sirve para revisar la medición pero no
 * para el día a día del dueño. Calidad de los datos, las pantallas técnicas
 * (mapa de calor, páginas, uso, navegador) y las dos reconstrucciones.
 */

const PANTALLAS = [
  { to: 'mapa-de-calor', titulo: 'Mapa de calor', texto: 'Dónde hacen clic, página por página.' },
  { to: 'paginas', titulo: 'Páginas y tiempo', texto: 'Las páginas más vistas, por día, y el seguimiento de pedidos.' },
  { to: 'uso', titulo: 'Uso y permanencia', texto: 'Funciones más usadas, cuánto bajan en cada página y dónde se quedan más.' },
  { to: 'navegador', titulo: 'Navegador y sistema', texto: 'Chrome, Safari…, Android, iPhone, Windows y regiones.' },
];

function RecalcularEstimado() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState('');
  const correr = async () => {
    setEstado('Recalculando…');
    const { error } = await rebuildHistoricalAnalyticsSummary();
    if (error) { setEstado(`No se pudo: ${error}`); return; }
    queryClient.invalidateQueries({ queryKey: ['admin-analytics-user-detail'] });
    setEstado('Listo.');
  };
  return (
    <div className={styles.accion}>
      <button type="button" className={styles.boton} onClick={correr} disabled={estado === 'Recalculando…'}>
        Recalcular compras de antes de medir
      </button>
      {estado && <span className={styles.estado}>{estado}</span>}
    </div>
  );
}

export default function DetalleTecnico() {
  const { filtros, analitica } = useOutletContext();
  const c = analitica.data?.calidad;
  const visitas = analitica.data?.visitas;

  return (
    <div className={styles.pagina}>
      <Columnas>
        <Tarjeta id="calidad" titulo="Calidad de los datos" ayuda="Qué se registró, qué se descartó y cómo se cuentan las visitas.">
          {c?.diasMedidos > 0 ? (
            <ul className={styles.calidad}>
              <li><span>Pestañas registradas</span><strong>{fmtInt(c.sesionesRegistradas)}</strong></li>
              <li><span>− Robots (buscadores y navegadores automáticos)</span><strong>{fmtInt(c.sesionesBot)}</strong></li>
              <li><span>− Equipo admin</span><strong>{fmtInt(c.sesionesAdmin)}</strong></li>
              <li><span>− Sin ninguna página vista</span><strong>{fmtInt(c.sinPaginas)}</strong></li>
              <li><span>− Otra pestaña de la misma visita (menos de 30 min)</span><strong>{fmtInt(c.unidas)}</strong></li>
              <li className={styles.total}><span>= Visitas</span><strong>{fmtInt(visitas?.total?.total)}</strong></li>
            </ul>
          ) : (
            <Vacio>Este periodo es anterior a la medición nueva.</Vacio>
          )}
          <p className={styles.nota}>
            Cada día se suma de madrugada y el de hoy cada 30 minutos. Un pedido cuenta al enviarse, aunque esté pendiente de pago.
          </p>
        </Tarjeta>

        <Tarjeta id="pantallas" titulo="Pantallas técnicas">
          <ul className={styles.pantallas}>
            {PANTALLAS.map((p) => (
              <li key={p.to}>
                <Link to={{ pathname: p.to, search: filtros.filtersSearch }} className={styles.pantalla}>
                  <strong>{p.titulo}</strong>
                  <span>{p.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </Columnas>

      <Tarjeta
        id="reconstruir"
        titulo="Reconstruir"
        ayuda='"Reconstruir el resumen diario" vuelve a sumar los días desde los eventos (después de un cambio en cómo se mide). "Recalcular compras de antes de medir" estima, con los pedidos del ERP, lo que compró cada cliente antes de que existiera la medición.'
      >
        <BackfillAnaliticaButton />
        <RecalcularEstimado />
      </Tarjeta>
    </div>
  );
}
