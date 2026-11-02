import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, EstadoVacio } from '../../Feedback';
import { Pestanas } from '../../Navegacion';
import { Hueso } from '../../Esqueletos';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, SinDatos, SelectorPeriodo } from '../../piezas/admin/Metricas';
import { GraficoTendencia } from '../../piezas/admin/Grafico';
import { ListaAvisos, TablaComparativa, ListaEnVivo, TarjetaEnlacesRotos } from '../../piezas/admin/Resultados';
import { cifrasDelResumen, otrosCobrosDe, serieDeVisitas, porCienVisitas, PERIODOS_RESULTADOS } from '../../adaptadoresAdmin';
import s from './Resultados.module.css';

/*
 * D4 · Resultados (/admin/resultados): cómo va la tienda. D4a: el marco
 * (periodo, comparar, actualizar y las pestañas) y el Resumen. Los datos
 * llegan como los arma useDashboardAnalytics; el kit no los lee.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const hora = (ms) => (ms ? new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '');
const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

/**
 * El marco de las pestañas de Resultados.
 *  - periodo: { id (PERIODOS_RESULTADOS), etiqueta ('30 días', 'hoy'), contra ('el periodo anterior', 'ayer') }
 *  - onPeriodo(id) · desde · hasta · onFechas(desde, hasta) · hoy ('AAAA-MM-DD', el tope)
 *  - comparar · onComparar(si) · datosAl (ms) · actualizando · onActualizar()
 *  - pestanas: [{ id, texto }] (ya filtradas por permiso) · pestana · onPestana(id) · children
 */
export function MarcoResultados({
  periodo = {}, onPeriodo, desde, hasta, onFechas, hoy, comparar = false, onComparar, datosAl, actualizando = false, onActualizar,
  pestanas = [], pestana, onPestana, children,
}) {
  const subtitulo = ['Cómo va tu tienda', `${periodo.etiqueta || ''}${comparar ? ` comparado con ${periodo.contra}` : ''}`, datosAl && `datos al ${hora(datosAl)}`].filter(Boolean).join(' · ');
  return (
    <div className={s.pagina} data-componente="MarcoResultados">
      <CabezaAdmin
        icono="resultados"
        tono="oro"
        titulo="Resultados"
        subtitulo={subtitulo}
        acciones={onActualizar && <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>}
      />
      <div className={s.controles}>
        <SelectorPeriodo
          opciones={PERIODOS_RESULTADOS}
          valor={periodo.id}
          onCambiar={onPeriodo}
          desde={desde}
          hasta={hasta}
          onFechas={onFechas}
          max={hoy}
          comparar={comparar}
          onComparar={onComparar}
          textoComparar={`Comparar con ${periodo.contra || 'el periodo anterior'}`}
        />
      </div>
      {pestanas.length > 1 && (
        <div className={s.pestanas}>
          <Pestanas etiqueta="Secciones de Resultados" opciones={pestanas} valor={pestana} onChange={onPestana} />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * El Resumen: cuatro cifras con su cambio, lo que conviene mejorar, las
 * visitas por día, de dónde vienen y quién está ahora.
 *  - datos · anterior (useDashboardAnalytics) · comparar · periodo: { dia ('hoy' | 'ayer' | null), contra, anteriorTexto }
 *  - cargando · error · avisos: [{ id, nivel, titulo, texto, to }] (cosasPorMejorar con su destino)
 *  - nombrePagina(path) → 'Tienda' (prettyRouteName) · verCanales (to: la pestaña Visitantes)
 *  - enlacesRotos: las props de TarjetaEnlacesRotos (sale solo si hay sin resolver)
 *  - ahora (para el aviso de "hoy va hasta las…")
 */
export function PaginaResumenResultados({
  datos, anterior, comparar = false, periodo = {}, cargando = false, error, avisos = [], nombrePagina = (p) => p,
  verCanales, enlacesRotos, ahora = Date.now(),
}) {
  const [canal, setCanal] = useState('');
  const canales = datos?.canales || [];
  const elegido = canal ? canales.find((c) => c.canal === canal) : null;
  const { cifras, comparativa, hayAnterior } = useMemo(() => cifrasDelResumen({ datos, anterior, comparar, canal: elegido }), [datos, anterior, comparar, elegido]);
  const otros = useMemo(() => otrosCobrosDe(datos?.otrosCobros), [datos?.otrosCobros]);
  const serie = useMemo(() => serieDeVisitas(datos?.visitasPorDia), [datos?.visitasPorDia]);
  const enVivo = useMemo(() => (datos?.realtimeSessionsDetails || []).map((p) => ({
    id: p.id, quien: p.displayName || p.email, conCuenta: p.hasAccount, pagina: nombrePagina(p.lastPath), vistoMs: p.lastSeenAtMs,
  })), [datos?.realtimeSessionsDetails, nombrePagina]);
  const rotosSinResolver = (enlacesRotos?.enlaces || []).filter((e) => !e.resueltaA).length;

  if (error) return <Aviso tipo="error" titulo="No se pudieron cargar los resultados">{error}</Aviso>;
  if (cargando && !datos) {
    return (
      <div className={s.resumen} aria-busy="true">
        <FilaCifras>{cifras.map((c) => <Cifra key={c.id} nombre={c.nombre} cargando />)}</FilaCifras>
        <ColumnasMetricas><Hueso forma="bloque" alto={220} /><Hueso forma="bloque" alto={220} /></ColumnasMetricas>
      </div>
    );
  }
  if (!datos) return <EstadoVacio titulo="Sin resultados todavía" texto="Cuando la tienda tenga visitas, aquí aparecen sus números." />;

  return (
    <div className={s.resumen} data-componente="PaginaResumenResultados">
      <FilaCifras etiqueta="Cómo va la tienda">
        {cifras.map((c) => <Cifra key={c.id} nombre={c.nombre} valor={c.valor} cambio={c.cambio} explicacion={c.explicacion} tono={{ visitas: 'violeta', pedidos: 'exito', ventas: 'aviso', conversion: 'cielo' }[c.id]} />)}
      </FilaCifras>

      {elegido && (
        <Aviso tipo="info" compacto accion={<Boton tamano="sm" variante="fantasma" onClick={() => setCanal('')}>Ver todas</Boton>}>
          Mostrando solo las visitas de {elegido.canal}.
        </Aviso>
      )}
      {otros && <p className={s.nota}><strong>Otros cobros: {otros.montos}</strong> ({otros.detalle}). No son pedidos de la tienda, por eso van aparte.</p>}
      {!datos.diasConResultados && (
        <Aviso tipo="aviso" compacto>Los pedidos y las ventas de este periodo todavía no están sumados. Se cuentan desde el 24/10/2026; para los días anteriores, usa «Reconstruir el resumen diario» en Detalle técnico.</Aviso>
      )}
      {comparar && !hayAnterior && <Aviso tipo="info" compacto>{mayuscula(periodo.contra)} todavía no tiene pedidos ni ventas sumados: no se puede comparar.</Aviso>}

      {comparativa.length > 0 && (
        <BloqueMetrica
          titulo={periodo.dia ? `${mayuscula(periodo.dia)} contra ${periodo.contra}` : 'Este periodo contra el anterior'}
          ayuda={periodo.dia === 'hoy' ? `Hoy va hasta las ${hora(ahora)}; ayer es el día completo. Es normal que hoy vaya por debajo hasta que acabe el día.` : periodo.anteriorTexto && `Periodo anterior: ${periodo.anteriorTexto}.`}
        >
          <TablaComparativa filas={comparativa} columnas={periodo.dia ? [mayuscula(periodo.dia), mayuscula(periodo.contra)] : undefined} />
        </BloqueMetrica>
      )}

      <ColumnasMetricas>
        <BloqueMetrica titulo="Cosas por mejorar"><ListaAvisos avisos={avisos} /></BloqueMetrica>
        <GraficoTendencia titulo="Visitas por día" datos={serie} series={[{ id: 'visitas', nombre: 'Visitas', tono: 'violeta' }]} formato={entero} vacio="Sin visitas en este periodo." />
      </ColumnasMetricas>

      <ColumnasMetricas>
        <BloqueMetrica
          titulo="De dónde vienen"
          ayuda="Los 3 canales con más visitas. Toca uno para ver los números solo de ahí."
          acciones={verCanales && <Boton tamano="sm" variante="fantasma" to={verCanales}>Ver todos</Boton>}
        >
          {!canales.length ? <SinDatos>Sin datos de origen en este periodo.</SinDatos> : (
            <ul className={s.canales}>
              {canales.slice(0, 3).map((c) => {
                const activo = canal === c.canal;
                return (
                  <li key={c.canal}>
                    <button type="button" className={activo ? s.canalActivo : s.canal} aria-pressed={activo} onClick={() => setCanal(activo ? '' : c.canal)}>
                      <span className={s.canalNombre}>{c.canal}</span>
                      <span><b>{entero(c.visitas)}</b> visitas</span>
                      <span><b>{entero(c.pedidos)}</b> pedidos</span>
                      <span><b>{porCienVisitas(c.pedidos, c.visitas).toLocaleString('es-PE', { maximumFractionDigits: 1 })}</b> de cada 100</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </BloqueMetrica>
        <BloqueMetrica titulo={<>Ahora en la tienda <span className={s.contador}>{entero(enVivo.length)}</span></>}>
          <ListaEnVivo personas={enVivo} />
        </BloqueMetrica>
      </ColumnasMetricas>

      {rotosSinResolver > 0 && <div id="enlaces"><TarjetaEnlacesRotos {...enlacesRotos} /></div>}
    </div>
  );
}
