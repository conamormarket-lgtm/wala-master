import React, { useState } from 'react';
import { BloqueMetrica, ListaBarras, SinDatos } from './Metricas';
import { Selector } from '../../Formulario';
import { Aviso } from '../../Feedback';
import { EsqueletoTexto } from '../../Esqueletos';
import Boton from '../../Boton';
import { LUMI_ACTIONS, LUMI_STAGES } from '../../../../services/analytics/lumiFunnel.mjs';
import s from './EmbudoLumi.module.css';

const STAGES = { catalog: 'Catálogo', product: 'Producto', add: 'Agregó al carrito', cart: 'Carrito', payment: 'Medios de pago', whatsapp: 'Clic a WhatsApp' };
const fecha = value => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value);
const contexto = d => [d?.productName, d?.brand, d?.method, d?.reason, Number.isFinite(d?.total) ? `Total: S/ ${d.total.toFixed(2)}` : ''].filter(Boolean).join(' · ');
const PAGE_SIZE = 20;

export default function EmbudoLumi({ data, cargando, error, onActualizar }) {
  const [filtro, setFiltro] = useState('');
  const [pagina, setPagina] = useState(0);
  const visitors = (data?.visitors || []).filter(v => !filtro || v.furthest === filtro);
  const page = Math.min(pagina, Math.max(0, Math.ceil(visitors.length / PAGE_SIZE) - 1));
  const filas = LUMI_STAGES.map(id => ({ id, nombre: STAGES[id], valor: data?.total?.[id] || 0,
    texto: `${data?.total?.[id] || 0} visitantes`,
    nota: id === 'product' ? 'Opcional: se puede agregar desde el catálogo' : id === 'whatsapp' ? 'Clic en el botón; no confirma el envío del comprobante ni el pago' : undefined }));
  return <BloqueMetrica titulo="Recorrido de Lumi" ayuda="Visitantes de /lumi/landing y el punto al que llegaron en el periodo seleccionado."
    acciones={<Boton tamano="sm" variante="fantasma" cargando={cargando} onClick={onActualizar}>Actualizar Lumi</Boton>}>
    <div className={s.contenido}>
      {error ? <Aviso tipo="error" titulo="No se pudo cargar el recorrido de Lumi">{error}</Aviso>
        : !data ? <EsqueletoTexto lineas={5} />
          : !data.total.catalog ? <SinDatos>Aún no hay visitas medidas de Lumi en este periodo. La medición comienza con esta actualización.</SinDatos>
            : <>
              <ListaBarras filas={filas} max={6} conCeros multilinea />
              <Selector className={s.filtro} etiqueta="Paso más avanzado de la última visita" valor={filtro} onCambiar={v => { setFiltro(v); setPagina(0); }}
                opciones={[{ valor: '', texto: 'Todos los visitantes' }, ...LUMI_STAGES.map(id => ({ valor: id, texto: STAGES[id] }))]} />
              <p className={s.nota}>{visitors.length} visitantes · Última actividad en hora de Lima. Abre «Ver recorrido» para consultar las etapas registradas.</p>
              <div className={s.tabla}>
                <table>
                  <caption className={s.caption}>Dónde se quedó cada visitante de Lumi</caption>
                  <thead><tr><th>Visitante</th><th>Última actividad</th><th>Última acción</th><th>Paso más avanzado</th></tr></thead>
                  <tbody>{visitors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(v => <tr key={v.anonymousId}>
                    <td><span title={v.anonymousId}>Visitante {v.anonymousId.slice(-8)}</span>
                      <details><summary>Ver recorrido</summary>
                        <p className={s.identificador}>{v.anonymousId}</p>
                        <ol>{Object.entries(v.reached).sort((a, b) => a[1] - b[1]).map(([step, ts]) => <li key={step}>{fecha(ts)} · {LUMI_ACTIONS[step]}</li>)}</ol>
                      </details>
                    </td>
                    <td>{fecha(v.lastAtMs)}</td>
                    <td><strong>{LUMI_ACTIONS[v.lastStep]}</strong>{contexto(v.details) && <small>{contexto(v.details)}</small>}</td>
                    <td>{STAGES[v.furthest]}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              {!visitors.length && <SinDatos>No hay visitantes que se hayan quedado en este paso.</SinDatos>}
              {visitors.length > PAGE_SIZE && <div className={s.paginacion}>
                <Boton tamano="sm" variante="contorno" disabled={page === 0} onClick={() => setPagina(page - 1)}>Anterior</Boton>
                <span>Página {page + 1} de {Math.ceil(visitors.length / PAGE_SIZE)}</span>
                <Boton tamano="sm" variante="contorno" disabled={(page + 1) * PAGE_SIZE >= visitors.length} onClick={() => setPagina(page + 1)}>Siguiente</Boton>
              </div>}
            </>}
      <p className={s.nota}>Cada navegador se cuenta una vez por etapa en el periodo. La tabla muestra su visita más reciente y distingue la última acción del paso más avanzado; puede haber regresado al catálogo o seguir navegando. No equivale a un abandono confirmado.</p>
      <p className={s.nota}>Se incluyen recorridos iniciados en el periodo, durante un máximo de 24 horas en la misma pestaña. No se reconstruyen visitas anteriores a esta actualización. Administradores y bots se excluyen. El clic a WhatsApp no permite saber si envió el comprobante o pagó.</p>
    </div>
  </BloqueMetrica>;
}
