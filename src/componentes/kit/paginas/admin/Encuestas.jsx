import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Plus, RefreshCw, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Chip } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, BarraGuardar, CampoLista } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, ListaBarras, SinDatos } from '../../piezas/admin/Metricas';
import { resumenEntregas } from '../../../../services/encuestaEntrega.mjs';
import {
  resumenEncuesta, fichaCliente, csvRespuestas, fechaEncuesta, filtrarPorFecha, porPeriodo, textoFechaEncuesta, diaLocal, EMBUDO_DESDE,
} from '../../../../services/surveyResponses.mjs';
import {
  TIPOS_PREGUNTA, preguntaNueva, separarPreguntas, entregaPanelDesde, cambioPorcentual, cambioEnPuntos, cambioEstrellas,
  estrellasTexto, unidadDeRango, etiquetaDePeriodo, fechaDeDia, normalizarBusqueda,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Encuestas.module.css';
import { EsqueletoFormulario, EsqueletoTexto } from '../../Esqueletos';

/*
 * D5e · Encuestas. El editor de la encuesta de suscripción
 * (/admin/encuestas) y las dos pantallas de respuestas que van dentro de
 * Resultados › Opiniones: "Cómo les fue con su pedido" y la encuesta de
 * regalos. La config se edita tal cual la lee la encuesta del cliente; las
 * cuentas son las de services/surveyResponses.mjs y encuestaEntrega.mjs.
 */

const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const fecha = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const respuestasTexto = (n) => `${entero(n)} ${Number(n) === 1 ? 'respuesta' : 'respuestas'}`;
const barras = (items = [], base) => items.map((x) => ({ id: x.valor, nombre: x.valor, valor: x.total, texto: base ? `${entero(x.total)} · ${Math.round((x.total / (base || 1)) * 100)} %` : entero(x.total) }));

/* ── El editor de la encuesta ──────────────────────────── */

const PESTANAS_EDITOR = [
  { id: 'portada', texto: 'Inicio' },
  { id: 'sobreTi', texto: 'Sobre ti' },
  { id: 'intereses', texto: 'Gustos' },
  { id: 'final', texto: 'Final' },
];

/** Las opciones de una pregunta (CampoLista). */
const OpcionesPregunta = ({ opciones = [], onCambiar }) => (
  <CampoLista etiqueta="Opciones" valores={opciones} onCambiar={onCambiar} textoCampo="Agregar una opción" placeholder="Ej. Vivo en pareja" />
);

/** Una pregunta de la encuesta. `conRefina`: las de un interés, que pueden solo ordenar las ideas. */
function EditorPregunta({ pregunta: f, numero, onCambiar, onQuitar, conRefina = false }) {
  const marcas = f.fuente === 'marcas';
  return (
    <article className={[s.pregunta, f.enEncuesta === false && s.preguntaRetirada].filter(Boolean).join(' ')}>
      <header className={s.preguntaCabeza}>
        <strong>Pregunta {numero}</strong>
        <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar}>Eliminar</Boton>
      </header>
      <div className={s.dos}>
        <Campo etiqueta="La pregunta" value={f.label} onChange={(e) => onCambiar('label', e.target.value)} />
        <Campo etiqueta="Se responde con" opciones={TIPOS_PREGUNTA} value={f.type} disabled={marcas} onChange={(e) => onCambiar('type', e.target.value)} />
      </div>
      <div className={s.interruptores}>
        <Interruptor etiqueta="Sale en la encuesta" descripcion={f.enEncuesta === false ? 'No sale: se guarda para ver las respuestas de antes.' : undefined} activo={f.enEncuesta !== false} onChange={(v) => onCambiar('enEncuesta', v)} />
        <Interruptor etiqueta="Obligatoria" activo={Boolean(f.required)} onChange={(v) => onCambiar('required', v)} />
        {conRefina && (
          <Interruptor
            etiqueta="Busca productos por sí sola"
            descripcion={f.refina ? 'Solo ordena: sube los productos que ya le gustan por sus otras respuestas (la taza de su equipo).' : undefined}
            activo={!f.refina}
            onChange={(v) => onCambiar('refina', !v)}
          />
        )}
      </div>
      {marcas && <p className={s.nota}>Solo sale al elegir «Ya compré en una de sus marcas». Las opciones son las marcas de la tienda.</p>}
      {f.type === 'select' && !marcas && <OpcionesPregunta opciones={f.options || []} onCambiar={(v) => onCambiar('options', v)} />}
    </article>
  );
}

/** Las preguntas de un grupo: arriba las que salen; plegadas, las que ya no (según lo guardado). */
function ListaPreguntas({ campos = [], guardadas, onCambiar, onQuitar, conRefina }) {
  const { activas, retiradas } = separarPreguntas(campos, guardadas);
  const pintar = ({ pregunta, indice }, n) => (
    <EditorPregunta key={pregunta.id} pregunta={pregunta} numero={n + 1} conRefina={conRefina} onCambiar={(k, v) => onCambiar(indice, k, v)} onQuitar={() => onQuitar(indice)} />
  );
  return (
    <div className={s.preguntas}>
      {activas.map(pintar)}
      {!activas.length && <p className={s.nota}>Ninguna pregunta de aquí sale en la encuesta.</p>}
      {retiradas.length > 0 && (
        <details className={s.retiradas}>
          <summary>Ya no se preguntan ({retiradas.length}) · para volver a usar una, prende «Sale en la encuesta» y guarda</summary>
          <div className={s.preguntas}>{retiradas.map((x, n) => pintar(x, activas.length + n))}</div>
        </details>
      )}
    </div>
  );
}

const TEXTO_QUITAR = 'Desaparece de la encuesta y de las respuestas, y no se puede recuperar. Si quizás la vuelvas a usar, mejor apaga «Sale en la encuesta».';

/**
 * El editor de la encuesta de suscripción (/admin/encuestas).
 *  - config: la de tienda_encuesta_config/global, mezclada con DEFAULT_SURVEY_CONFIG
 *  - guardada: lo que hay guardado (para separar las que ya no se preguntan) ·
 *    categoriasTienda: [{ valor, texto }] · cargando · error · onReintentar
 *  - onGuardar(config) → promesa (el conector le pone el historial: configConHistorial)
 *  - urlRespuestas: "Ver respuestas" · pestana + onPestana
 */
export function PaginaEncuestaAdmin({ config, guardada, categoriasTienda = [], cargando = false, error, onReintentar, onGuardar, urlRespuestas = '/admin/resultados/opiniones', pestana: pestanaFuera, onPestana }) {
  const toast = useToast();
  const [pestanaDentro, setPestanaDentro] = useState('portada');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [c, setC] = useState(config);
  const [guardando, setGuardando] = useState(false);
  const [quitar, setQuitar] = useState(null); // { titulo, texto, accion }
  useEffect(() => { setC(config); }, [config]);
  const sucio = Boolean(c && config) && !mismo(c, config);

  const panel = (nombre, campo, v) => setC((x) => ({ ...x, [nombre]: { ...x[nombre], [campo]: v } }));
  const basicos = (fn) => setC((x) => ({ ...x, basicDataPanel: { ...x.basicDataPanel, fields: fn(x.basicDataPanel.fields || []) } }));
  const categorias = (fn) => setC((x) => ({ ...x, brandsPanel: { ...x.brandsPanel, categories: fn(x.brandsPanel.categories || []) } }));
  const categoria = (i, fn) => categorias((cs) => cs.map((cat, j) => (j === i ? fn(cat) : cat)));
  const cambiarEn = (lista, i, k, v) => lista.map((f, j) => (j === i ? { ...f, [k]: v } : f));
  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(c);
      toast({ tipo: 'exito', titulo: 'Encuesta guardada', texto: 'Los clientes la ven así desde ahora.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };

  const cabeza = (
    <CabezaAdmin
      icono="encuesta"
      tono="rosa"
      titulo="Encuesta de suscripción"
      subtitulo="La encuesta de regalos que llenan al crear su cuenta: sus datos, a quiénes regalan y los gustos de cada persona."
      acciones={<Boton tamano="sm" variante="secundario" to={urlRespuestas} icono={<ExternalLink aria-hidden="true" />}>Ver respuestas</Boton>}
    />
  );
  if (error) {
    return (
      <div className={s.pagina} data-componente="PaginaEncuestaAdmin">
        {cabeza}
        <Aviso tipo="error" titulo="No pudimos cargar la encuesta" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error} Mientras no cargue, no se puede guardar: pisaría la que hay.</Aviso>
      </div>
    );
  }
  if (cargando || !c) return <div className={s.pagina}>{cabeza}<EsqueletoFormulario campos={4} /></div>;

  return (
    <div className={s.pagina} data-componente="PaginaEncuestaAdmin">
      {cabeza}
      <div className={s.pestanas}>
        <Pestanas etiqueta="Partes de la encuesta" opciones={PESTANAS_EDITOR} valor={pestana} onChange={ir} />
      </div>

      {pestana === 'portada' && (
        <GrupoCampos titulo="Lo primero que ve" ayuda="Antes de empezar: el gancho para que la llene.">
          <Campo etiqueta="Título" value={c.introPanel.title} onChange={(e) => panel('introPanel', 'title', e.target.value)} />
          <Campo etiqueta="Subtítulo" value={c.introPanel.subtitle} onChange={(e) => panel('introPanel', 'subtitle', e.target.value)} />
          <Campo etiqueta="El mensaje" ayuda="Sale debajo del premio." multilinea={3} value={c.introPanel.description} onChange={(e) => panel('introPanel', 'description', e.target.value)} />
          <div className={s.dos}>
            <Campo etiqueta="Botón para empezar" value={c.introPanel.continueButtonText} onChange={(e) => panel('introPanel', 'continueButtonText', e.target.value)} />
            <Campo etiqueta="Botón para no llenarla" value={c.introPanel.skipButtonText} onChange={(e) => panel('introPanel', 'skipButtonText', e.target.value)} />
          </div>
        </GrupoCampos>
      )}

      {pestana === 'sobreTi' && (
        <>
          <GrupoCampos titulo="El paso" columnas={2}>
            <Campo etiqueta="Título" value={c.basicDataPanel.title} onChange={(e) => panel('basicDataPanel', 'title', e.target.value)} />
            <Campo etiqueta="Subtítulo" value={c.basicDataPanel.subtitle} onChange={(e) => panel('basicDataPanel', 'subtitle', e.target.value)} />
          </GrupoCampos>
          <GrupoCampos titulo="Las preguntas" ayuda="El nombre y el cumpleaños salen de la cuenta: solo se preguntan a quien no los tiene. Si no queda nada que preguntar, el paso se salta.">
            <ListaPreguntas
              campos={c.basicDataPanel.fields}
              guardadas={guardada?.basicDataPanel?.fields}
              onCambiar={(i, k, v) => basicos((fs) => cambiarEn(fs, i, k, v))}
              onQuitar={(i) => setQuitar({ titulo: '¿Eliminar esta pregunta?', texto: TEXTO_QUITAR, accion: () => basicos((fs) => fs.filter((_, j) => j !== i)) })}
            />
            <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => basicos((fs) => [...fs, preguntaNueva('field')])}>Añadir una pregunta</Boton>
          </GrupoCampos>
        </>
      )}

      {pestana === 'intereses' && (
        <>
          <GrupoCampos titulo="En la hoja de cada persona">
            <Interruptor etiqueta="Preguntar cuánto suele gastar en su regalo" descripcion="El presupuesto: sirve en la encuesta y en Fechas importantes." activo={Boolean(c.personPanel?.budget)} onChange={(v) => panel('personPanel', 'budget', v)} />
            <Interruptor etiqueta="Mostrar el «Conjunto familia»" descripcion="Regalos para compartir en casa. Solo en la encuesta." activo={Boolean(c.personPanel?.familySet)} onChange={(v) => panel('personPanel', 'familySet', v)} />
          </GrupoCampos>
          <GrupoCampos titulo="El paso de los intereses" columnas={2} ayuda="Cada interés es un botón en la hoja de cada persona («¿Le gusta algo de esto?»); al tocarlo salen sus preguntas. Para que sea corta: una pregunta por interés, o ninguna si ya está ligado a categorías de la tienda.">
            <Campo etiqueta="Título" value={c.brandsPanel.title || ''} onChange={(e) => panel('brandsPanel', 'title', e.target.value)} />
            <Campo etiqueta="Subtítulo" value={c.brandsPanel.subtitle || ''} onChange={(e) => panel('brandsPanel', 'subtitle', e.target.value)} />
          </GrupoCampos>
          {(c.brandsPanel.categories || []).map((cat, ci) => {
            const tienda = cat.tiendaCategorias || [];
            return (
              <section key={cat.id} className={s.interes} aria-label={`Interés ${cat.name}`}>
                <div className={s.interesCabeza}>
                  <Campo etiqueta="El interés" value={cat.name} onChange={(e) => categoria(ci, (x) => ({ ...x, name: e.target.value }))} />
                  <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => setQuitar({ titulo: `¿Eliminar «${cat.name}»?`, texto: `Con todas sus preguntas. ${TEXTO_QUITAR}`, accion: () => categorias((cs) => cs.filter((_, j) => j !== ci)) })}>Eliminar el interés</Boton>
                </div>
                <div className={s.opciones}>
                  <span className={s.etiqueta}>Recomendar productos de estas categorías</span>
                  <p className={s.nota}>Las ideas de regalo usan sobre todo lo que responde (equipo, anime, personaje…); estas categorías suman como apoyo.</p>
                  <span className={s.chips} role="group" aria-label={`Categorías de la tienda para ${cat.name}`}>
                    {categoriasTienda.map((ct) => (
                      <Chip key={ct.valor} tamano="sm" activo={tienda.includes(ct.valor)} onClick={() => categoria(ci, (x) => ({ ...x, tiendaCategorias: tienda.includes(ct.valor) ? tienda.filter((v) => v !== ct.valor) : [...tienda, ct.valor] }))}>
                        {ct.texto}
                      </Chip>
                    ))}
                  </span>
                </div>
                <span className={s.etiqueta}>Preguntas para quien elija «{cat.name}»</span>
                <ListaPreguntas
                  campos={cat.fields}
                  guardadas={guardada?.brandsPanel?.categories?.find((g) => g.id === cat.id)?.fields}
                  conRefina
                  onCambiar={(i, k, v) => categoria(ci, (x) => ({ ...x, fields: cambiarEn(x.fields || [], i, k, v) }))}
                  onQuitar={(i) => setQuitar({ titulo: '¿Eliminar esta pregunta?', texto: TEXTO_QUITAR, accion: () => categoria(ci, (x) => ({ ...x, fields: (x.fields || []).filter((_, j) => j !== i) })) })}
                />
                <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => categoria(ci, (x) => ({ ...x, fields: [...(x.fields || []), preguntaNueva('brandField')] }))}>Añadir una pregunta a {cat.name}</Boton>
              </section>
            );
          })}
          <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => categorias((cs) => [...cs, { id: `cat_${Date.now()}`, name: 'Nuevo interés', fields: [] }])}>Crear un interés</Boton>
        </>
      )}

      {pestana === 'final' && (
        <GrupoCampos titulo="Al terminar">
          <Campo etiqueta="Título" value={c.completionPanel.title} onChange={(e) => panel('completionPanel', 'title', e.target.value)} />
          <Campo etiqueta="El agradecimiento" multilinea={3} value={c.completionPanel.message} onChange={(e) => panel('completionPanel', 'message', e.target.value)} />
          <Campo etiqueta="Botón final" value={c.completionPanel.buttonText} onChange={(e) => panel('completionPanel', 'buttonText', e.target.value)} />
          <Interruptor
            etiqueta="Preguntar si quiere promociones por WhatsApp"
            descripcion="Solo a quien no lo tiene activado; si dice que no, se le pregunta «¿Estás seguro?». Es el mismo interruptor de «Ofertas por WhatsApp» de Mi perfil."
            activo={c.completionPanel.askWhatsapp !== false}
            onChange={(v) => panel('completionPanel', 'askWhatsapp', v)}
          />
        </GrupoCampos>
      )}

      <BarraGuardar visible={sucio} onDescartar={() => setC(config)} onGuardar={guardar} guardando={guardando} />
      <Confirmar
        abierta={Boolean(quitar)}
        titulo={quitar?.titulo}
        texto={quitar?.texto}
        confirmar="Eliminar"
        peligro
        onCancelar={() => setQuitar(null)}
        onConfirmar={() => { quitar.accion(); setQuitar(null); }}
      />
    </div>
  );
}

/* ── Respuestas: "Cómo les fue con su pedido" ──────────── */

/**
 * Las respuestas de la encuesta de entrega (dentro de Resultados › Opiniones).
 *  - config: entregaPanel crudo · onGuardarConfig(entregaPanel) → promesa
 *  - respuestas: [{ id, estrellas, mejorar, comentario, fecha (ms), codigo, nombre, email }]
 *    (resultadosEncuestaEntrega) · cargando · error · onActualizar · actualizando
 *  - desdeMs · hastaMs (el periodo de Resultados) · previo: { desdeMs, hastaMs, contra }
 */
export function RespuestasEntregas({ config, onGuardarConfig, respuestas = [], cargando = false, error, onActualizar, actualizando = false, desdeMs = null, hastaMs = null, previo = null }) {
  const toast = useToast();
  const cfg = useMemo(() => entregaPanelDesde(config), [config]);
  const [ajustes, setAjustes] = useState(null);
  const [visibles, setVisibles] = useState(20);
  const enRango = (d, h) => respuestas.filter((r) => (d == null || r.fecha >= d) && (h == null || r.fecha <= h));
  const r = useMemo(() => resumenEntregas(enRango(desdeMs, hastaMs), cfg.opcionesMejorar), [respuestas, desdeMs, hastaMs, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useMemo(() => (previo ? resumenEntregas(enRango(previo.desdeMs, previo.hastaMs), cfg.opcionesMejorar) : null), [respuestas, previo, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparable = Boolean(a && a.total && r.total);

  const guardar = async () => {
    try {
      await onGuardarConfig?.(entregaPanelDesde(ajustes));
      toast({ tipo: 'exito', titulo: 'Encuesta de entregas guardada' });
      setAjustes(null);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
      throw err;
    }
  };

  return (
    <div className={s.respuestas} data-componente="RespuestasEntregas">
      <div className={s.barra}>
        <p className={s.nota}>«¿Cómo te fue con tu pedido?»: llega con el aviso de pedido entregado y está en el detalle de cada pedido entregado. Una respuesta por pedido{cfg.activo ? `; da ${cfg.monedas} monedas` : ''}.</p>
        <span className={s.acciones}>
          {onGuardarConfig && <Boton tamano="sm" variante="secundario" icono={<Settings2 aria-hidden="true" />} onClick={() => setAjustes(cfg)}>Editar la encuesta</Boton>}
          {onActualizar && <Boton tamano="sm" variante="fantasma" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>}
        </span>
      </div>
      {!cfg.activo && <Aviso tipo="aviso" compacto>Está apagada: el aviso de entregado lleva a Mis pedidos y no se aceptan respuestas.</Aviso>}
      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar las respuestas" accion={onActualizar && <Boton tamano="sm" variante="contorno" onClick={onActualizar}>Reintentar</Boton>}>{error}</Aviso>
      ) : (
        <>
          <FilaCifras etiqueta="Resumen de la encuesta de entregas">
            <Cifra nombre="Respuestas" valor={entero(r.total)} cambio={a ? cambioPorcentual(r.total, a.total) : undefined} cargando={cargando} />
            <Cifra nombre="Promedio" valor={r.total ? `${r.promedio} ★` : '—'} cambio={comparable ? cambioEstrellas(r.promedio, a.promedio) : undefined} tono="aviso" cargando={cargando} />
            <Cifra nombre="Pusieron 4 o 5 estrellas" valor={r.total ? `${r.contentos} %` : '—'} cambio={comparable ? cambioEnPuntos(r.contentos, a.contentos) : undefined} tono="exito" cargando={cargando} />
          </FilaCifras>
          {previo && <p className={s.nota}>El cambio es contra {previo.contra}.</p>}
          <ColumnasMetricas>
            <BloqueMetrica titulo="¿Cómo te fue con tu pedido?">
              <ListaBarras filas={barras(r.porEstrellas, r.total)} conCeros vacio="Sin respuestas en este periodo." />
            </BloqueMetrica>
            <BloqueMetrica titulo="¿Qué podemos mejorar?" ayuda="Pueden elegir varias: no suman las respuestas.">
              <ListaBarras filas={barras(r.mejorar, r.total)} tono="menta" vacio="Nadie marcó nada que mejorar." />
            </BloqueMetrica>
          </ColumnasMetricas>
          <BloqueMetrica titulo={`Comentarios (${entero(r.comentarios.length)})`}>
            {r.comentarios.length ? (
              <ul className={s.comentarios}>
                {r.comentarios.slice(0, visibles).map((x) => (
                  <li key={x.id} className={s.comentario}>
                    <span className={s.comentarioCabeza}>
                      <span className={s.estrellas} aria-label={`${x.estrellas} de 5 estrellas`}>{estrellasTexto(x.estrellas)}</span>
                      <span className={s.nota}>Pedido {x.codigo} · {fecha(x.fecha)}</span>
                    </span>
                    <p>{x.comentario}</p>
                    <span className={s.nota}>{x.nombre || 'Sin nombre'}{x.email ? ` · ${x.email}` : ''}{x.mejorar?.length ? ` · Mejorar: ${x.mejorar.join(', ')}` : ''}</span>
                  </li>
                ))}
              </ul>
            ) : <SinDatos>Todavía no hay comentarios en este periodo.</SinDatos>}
            <CargarMas visibles={Math.min(visibles, r.comentarios.length)} total={r.comentarios.length} paso={30} onMas={() => setVisibles((v) => v + 30)} unidad={['comentario', 'comentarios']} />
          </BloqueMetrica>
        </>
      )}

      <HojaEdicion abierta={Boolean(ajustes)} titulo="Encuesta de entregas" subtitulo="«¿Cómo te fue con tu pedido?»" onCerrar={() => setAjustes(null)} onGuardar={guardar} sucio={Boolean(ajustes) && !mismo(ajustes, cfg)}>
        {ajustes && (
          <GrupoCampos titulo="La encuesta">
            <Interruptor etiqueta="Prendida" descripcion="Apagada: el aviso de entregado vuelve a llevar a Mis pedidos y no se aceptan respuestas." activo={ajustes.activo} onChange={(v) => setAjustes((x) => ({ ...x, activo: v }))} />
            <Campo etiqueta="Da por responder" type="number" inputMode="numeric" min={0} max={50} sufijo="monedas" ayuda="De 0 a 50." value={ajustes.monedas} onChange={(e) => setAjustes((x) => ({ ...x, monedas: e.target.value }))} />
            <OpcionesPregunta opciones={ajustes.opcionesMejorar} onCambiar={(v) => setAjustes((x) => ({ ...x, opcionesMejorar: v }))} />
            <p className={s.nota}>Son las de «¿Qué podemos mejorar?»: se eligen con un toque, varias.</p>
          </GrupoCampos>
        )}
      </HojaEdicion>
    </div>
  );
}

/* ── Respuestas: la encuesta de regalos ────────────────── */

/**
 * Lo que contestaron en la encuesta de suscripción (dentro de Resultados › Opiniones).
 *  - usuarios: perfiles con hasCompletedSurvey · config: la de la encuesta (mezclada)
 *  - cargando · error · onActualizar · actualizando
 *  - desde · hasta ('YYYY-MM-DD', el periodo de Resultados) · previo: { desde, hasta, contra }
 *  - embudo · embudoPrevio: [embudoEncuesta] · cargandoEmbudo · errorEmbudo
 *  - onVolverAPreguntar({ tipo, id, categoriaId }) → promesa (configConPregunta + historial)
 *  - urlEditar: "Editar la encuesta" · hoy ('YYYY-MM-DD')
 */
export function RespuestasEncuesta({
  usuarios = [], config, cargando = false, error, onActualizar, actualizando = false, desde = '', hasta = '', previo = null,
  embudo, embudoPrevio, cargandoEmbudo = false, errorEmbudo, onVolverAPreguntar, urlEditar = '/admin/encuestas', hoy = diaLocal(Date.now()),
}) {
  const toast = useToast();
  const [vista, setVista] = useState('actual');
  const [busqueda, setBusqueda] = useState('');
  const [visibles, setVisibles] = useState(30);
  const [abierto, setAbierto] = useState(null);
  const [reactivar, setReactivar] = useState(null);

  const enRango = useMemo(() => filtrarPorFecha(usuarios, desde, hasta), [usuarios, desde, hasta]);
  const r = useMemo(() => (config ? resumenEncuesta(enRango, config) : null), [enRango, config]);
  const a = useMemo(() => {
    if (!previo?.desde || !config) return null;
    const lista = filtrarPorFecha(usuarios, previo.desde, previo.hasta);
    return { total: lista.length, ...resumenEncuesta(lista, config) };
  }, [usuarios, previo, config]);
  const cambio = (actual, clave) => (a ? cambioPorcentual(actual, a[clave]) : undefined);
  const sinFecha = usuarios.filter((u) => !fechaEncuesta(u)).length;
  const unidad = desde ? unidadDeRango(desde, hasta || hoy) : 'mes';
  const periodos = porPeriodo(enRango, unidad).map((p) => ({ id: p.valor, nombre: etiquetaDePeriodo(p.valor, unidad), valor: p.total }));
  const previoPaso = new Map((embudoPrevio || []).map((p) => [p.id, p.total]));

  const preguntas = useMemo(() => {
    if (!r) return null;
    const gustos = r.gustos.map((g) => ({ ...g, actuales: g.preguntas.filter((q) => !q.retirada), retiradas: g.preguntas.filter((q) => q.retirada) }));
    const basicosRetirados = r.basicos.filter((b) => b.retirada);
    const cambiadas = [
      ...r.basicos.filter((b) => b.antes.length).map((b) => ({ clave: `b-${b.id}`, donde: 'Sobre ti', ahora: b.label, antes: b.antes, retirada: b.retirada })),
      ...r.gustos.filter((g) => g.antes.length).map((g) => ({ clave: `g-${g.id}`, donde: 'Nombre de un interés', ahora: g.nombre, antes: g.antes })),
      ...gustos.flatMap((g) => g.preguntas.filter((q) => q.antes.length).map((q) => ({ clave: `q-${g.id}-${q.id}`, donde: `Interés · ${g.nombre}`, ahora: q.label, antes: q.antes, retirada: q.retirada }))),
    ];
    return {
      basicos: r.basicos.filter((b) => !b.retirada), basicosRetirados, gustos, cambiadas,
      retiradas: basicosRetirados.length + (r.presupuestoRetirado ? 1 : 0) + gustos.reduce((n, g) => n + g.retiradas.length, 0),
    };
  }, [r]);

  const clientes = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return enRango
      .map((u) => ({ id: u.id || u.uid, u, nombre: u.displayName || u.surveyBasicData?.nombres || 'Sin nombre' }))
      .filter((x) => !q || normalizarBusqueda(`${x.nombre} ${x.u.email || ''} ${x.u.phone || ''}`).includes(q))
      .sort((x, y) => fechaEncuesta(y.u) - fechaEncuesta(x.u));
  }, [enRango, busqueda]);
  const ficha = abierto && config ? fichaCliente(clientes.find((x) => x.id === abierto)?.u || {}, config) : null;

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([csvRespuestas(enRango, config)], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `respuestas-encuesta-${desde || hasta ? `${desde || 'inicio'}_a_${hasta || 'hoy'}` : hoy}.csv`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  };

  const retirada = (desdeDia) => <span className={s.retiradaMarca}>Ya no se pregunta{fechaDeDia(desdeDia) && ` desde el ${fechaDeDia(desdeDia)}`}</span>;
  const botonReactivar = (que, nombre) => onVolverAPreguntar && (
    <Boton tamano="sm" variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={() => setReactivar({ que, nombre })}>Volver a preguntarla</Boton>
  );

  return (
    <div className={s.respuestas} data-componente="RespuestasEncuesta">
      <div className={s.barra}>
        <p className={s.nota}>Lo que contestaron al crear su cuenta: sus datos, a quiénes regalan y los gustos de cada persona. Los gustos más pedidos dicen qué productos conviene tener.</p>
        <span className={s.acciones}>
          <Boton tamano="sm" variante="secundario" to={urlEditar} icono={<Settings2 aria-hidden="true" />}>Editar la encuesta</Boton>
          {onActualizar && <Boton tamano="sm" variante="fantasma" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>}
          <Boton tamano="sm" icono={<Download aria-hidden="true" />} disabled={!r || cargando} onClick={descargar}>Descargar Excel</Boton>
        </span>
      </div>

      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar las respuestas" accion={onActualizar && <Boton tamano="sm" variante="contorno" onClick={onActualizar}>Reintentar</Boton>}>{error}</Aviso>
      ) : (
        <>
          <FilaCifras etiqueta="Resumen de la encuesta de regalos">
            <Cifra nombre={desde || hasta ? 'La llenaron en este periodo' : 'La llenaron'} valor={entero(enRango.length)} ayuda={`${entero(usuarios.length)} en total`} cambio={a ? cambioPorcentual(enRango.length, a.total) : undefined} cargando={cargando} />
            <Cifra nombre="Personas para regalar" valor={entero(r?.personas)} cambio={cambio(r?.personas, 'personas')} tono="exito" cargando={cargando || !r} />
            <Cifra nombre="Dieron su cumpleaños" valor={entero(r?.conCumpleanos)} cambio={cambio(r?.conCumpleanos, 'conCumpleanos')} tono="cielo" cargando={cargando || !r} />
            <Cifra nombre="Personas con presupuesto" valor={entero(r?.conPresupuesto)} ayuda={r?.presupuestoRetirado ? 'Ya no se pregunta' : undefined} cambio={cambio(r?.conPresupuesto, 'conPresupuesto')} tono="aviso" cargando={cargando || !r} />
          </FilaCifras>
          {sinFecha > 0 && <p className={s.nota}>{entero(sinFecha)} la llenaron antes del 29/06/2026 y no tienen fecha: cuentan en el total, no al filtrar por periodo.{previo ? ` El cambio es contra ${previo.contra}.` : ''}</p>}

          <ColumnasMetricas>
            <BloqueMetrica titulo="Hasta dónde llegan" ayuda={`Personas distintas en cada paso y su parte de las que entraron. Se registra desde el ${fechaDeDia(EMBUDO_DESDE)}.`}>
              {errorEmbudo ? <SinDatos>No se pudo cargar: {errorEmbudo}</SinDatos>
                : cargandoEmbudo || !embudo ? <EsqueletoTexto lineas={4} />
                  : !embudo[0]?.total ? <SinDatos>Nadie entró a la encuesta en este periodo.</SinDatos>
                    : (
                      <ListaBarras
                        max={embudo.length}
                        conCeros
                        filas={embudo.map((p) => {
                          const ant = previoPaso.get(p.id);
                          const c = ant != null ? cambioPorcentual(p.total, ant) : null;
                          return { id: p.id, nombre: p.label, valor: p.total, texto: `${entero(p.total)} · ${p.porcentaje} %`, sub: [p.aparte && 'aparte', p.nota, c && `${c.texto} contra ${previo?.contra}`].filter(Boolean).join(' · ') || undefined };
                        })}
                      />
                    )}
            </BloqueMetrica>
            <BloqueMetrica titulo={`La llenaron por ${unidad === 'dia' ? 'día' : 'mes'}`}>
              <ListaBarras filas={periodos} max={periodos.length || 1} tono="menta" vacio="Nadie la llenó en este periodo." />
            </BloqueMetrica>
          </ColumnasMetricas>

          {preguntas && (
            <>
              <div className={s.pestanas}>
                <Pestanas
                  etiqueta="Qué preguntas ver"
                  opciones={[{ id: 'actual', texto: 'La encuesta de hoy' }, { id: 'cambios', texto: `Cambios (${preguntas.retiradas + preguntas.cambiadas.length})` }]}
                  valor={vista}
                  onChange={setVista}
                />
              </div>
              {vista === 'actual' ? (
                <>
                  <h3 className={s.paso}>Paso 1 · Sobre ti</h3>
                  <p className={s.nota}>El nombre no se pregunta: sale de su cuenta.</p>
                  <div className={s.rejilla}>
                    <BloqueMetrica titulo="Su cumpleaños" ayuda="Solo se le pregunta a quien no lo tiene.">
                      <ListaBarras filas={barras([{ valor: 'Lo tienen', total: r.conCumpleanos }, { valor: 'No lo tienen', total: r.clientes - r.conCumpleanos }], r.clientes)} />
                    </BloqueMetrica>
                    {preguntas.basicos.map((b) => (
                      <BloqueMetrica key={b.id} titulo={b.label} ayuda={respuestasTexto(b.respondieron)}>
                        <ListaBarras filas={barras(b.opciones, b.respondieron)} />
                      </BloqueMetrica>
                    ))}
                  </div>
                  <h3 className={s.paso}>Paso 2 · ¿A quiénes sueles regalar?</h3>
                  <div className={s.rejilla}>
                    <BloqueMetrica titulo="A quiénes regalan" ayuda="Clientes que marcaron cada grupo.">
                      <ListaBarras filas={barras(r.aQuien, r.clientes)} />
                    </BloqueMetrica>
                  </div>
                  <h3 className={s.paso}>Paso 3 · Cada persona</h3>
                  <p className={s.nota}>{entero(r.personas)} personas. Cada interés es un botón: al tocarlo salen sus preguntas.</p>
                  <div className={s.rejilla}>
                    {!r.presupuestoRetirado && (
                      <BloqueMetrica titulo="Cuánto suelen gastar por regalo" ayuda={`${entero(r.conPresupuesto)} de ${entero(r.personas)} personas`}>
                        <ListaBarras filas={barras(r.presupuesto)} />
                      </BloqueMetrica>
                    )}
                    {preguntas.gustos.map((g) => (
                      <BloqueMetrica key={g.id} titulo={g.nombre} ayuda={`Interés · ${entero(g.personas)} personas lo marcaron`}>
                        {!g.actuales.length && <SinDatos>Solo se marca: no tiene preguntas.</SinDatos>}
                        {g.actuales.map((q) => (
                          <div key={q.id} className={s.subpregunta}>
                            <span className={s.subTitulo}>{q.label} <span className={s.nota}>({entero(q.respondieron)})</span>{q.refina && <span className={s.ordena}>solo ordena</span>}</span>
                            <ListaBarras filas={barras(q.top)} />
                          </div>
                        ))}
                      </BloqueMetrica>
                    ))}
                  </div>
                  <h3 className={s.paso}>Al final · Promociones por WhatsApp</h3>
                  <div className={s.rejilla}>
                    <BloqueMetrica titulo="¿Te avisamos de promociones por WhatsApp?" ayuda="Incluye a quien lo cambió en Mi perfil.">
                      <ListaBarras filas={barras([{ valor: 'Sí, quieren', total: r.whatsapp.si }, { valor: 'No quieren', total: r.whatsapp.no }, { valor: 'No respondieron', total: r.clientes - r.whatsapp.si - r.whatsapp.no }], r.clientes)} tono="menta" />
                    </BloqueMetrica>
                  </div>
                </>
              ) : (
                <>
                  <p className={s.nota}>Lo que ya no sale o cambió de texto. Las respuestas de antes se conservan aquí.</p>
                  <h3 className={s.paso}>Ya no se preguntan</h3>
                  {!preguntas.retiradas && <SinDatos>Todas las preguntas siguen en la encuesta.</SinDatos>}
                  <div className={s.rejilla}>
                    {preguntas.basicosRetirados.map((b) => (
                      <BloqueMetrica key={b.id} titulo={b.label} ayuda={`Sobre ti · ${respuestasTexto(b.respondieron)}`} acciones={retirada(b.retiradaEl)}>
                        <ListaBarras filas={barras(b.opciones, b.respondieron)} />
                        {botonReactivar({ tipo: 'basico', id: b.id }, b.label)}
                      </BloqueMetrica>
                    ))}
                    {r.presupuestoRetirado && (
                      <BloqueMetrica titulo="Cuánto suelen gastar por regalo" ayuda={`Cada persona · ${entero(r.conPresupuesto)} de ${entero(r.personas)}`} acciones={retirada(r.presupuestoRetiradoEl)}>
                        <ListaBarras filas={barras(r.presupuesto)} />
                        {botonReactivar({ tipo: 'presupuesto' }, 'el presupuesto')}
                      </BloqueMetrica>
                    )}
                    {preguntas.gustos.filter((g) => g.retiradas.length).map((g) => (
                      <BloqueMetrica key={g.id} titulo={g.nombre} ayuda="Interés">
                        {g.retiradas.map((q) => (
                          <div key={q.id} className={s.subpregunta}>
                            {retirada(q.retiradaEl)}
                            <span className={s.subTitulo}>{q.label} <span className={s.nota}>({entero(q.respondieron)})</span></span>
                            <ListaBarras filas={barras(q.top)} />
                            {botonReactivar({ tipo: 'gusto', categoriaId: g.id, id: q.id }, q.label)}
                          </div>
                        ))}
                      </BloqueMetrica>
                    ))}
                  </div>
                  <h3 className={s.paso}>Cambiaron de texto</h3>
                  {preguntas.cambiadas.length ? (
                    <>
                      <p className={s.nota}>Es la misma pregunta: sus respuestas de antes y de ahora se cuentan juntas.</p>
                      <ul className={s.cambiadas}>
                        {preguntas.cambiadas.map((x) => (
                          <li key={x.clave}>
                            <span className={s.nota}>{x.donde}</span>
                            <span><strong>Ahora:</strong> {x.ahora}{x.retirada && <> {retirada()}</>}</span>
                            {x.antes.map((y, i) => <span key={i} className={s.nota}>Antes: «{y.label}»{y.hasta && ` (hasta el ${fechaDeDia(y.hasta)})`}</span>)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : <SinDatos>Ninguna pregunta cambió de texto.</SinDatos>}
                </>
              )}
            </>
          )}

          <h3 className={s.paso}>Por cliente</h3>
          <BarraFiltros busqueda={busqueda} onBusqueda={(t) => { setBusqueda(t); setVisibles(30); }} placeholder="Buscar por nombre, correo o teléfono" total={cargando ? undefined : clientes.length} unidad={['cliente', 'clientes']} />
          <TablaAdmin
            etiqueta="Clientes que llenaron la encuesta"
            filas={clientes.slice(0, visibles)}
            nombreDe={(x) => x.nombre}
            cargando={cargando}
            onFila={(x) => setAbierto(x.id)}
            vacio={usuarios.length ? { titulo: 'Nadie coincide', texto: 'Busca otra cosa o cambia el periodo.' } : { titulo: 'Todavía nadie la llenó', texto: 'Cuando alguien la complete, aparece aquí.' }}
            columnas={[
              { id: 'nombre', titulo: 'Cliente', tarjeta: 'titulo', celda: (x) => <>{x.nombre}<span className={l.sub}>{x.u.email || 'Sin correo'}</span></> },
              { id: 'fecha', titulo: 'La llenó', ancho: 170, tarjeta: 'detalle', celda: (x) => textoFechaEncuesta(x.u) },
              { id: 'personas', titulo: 'Personas', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (x) => <span className={l.numero}>{entero(x.u.giftRecipients?.length)}</span> },
            ]}
          />
          <CargarMas visibles={Math.min(visibles, clientes.length)} total={clientes.length} paso={50} onMas={() => setVisibles((v) => v + 50)} unidad={['cliente', 'clientes']} />
        </>
      )}

      <HojaEdicion abierta={Boolean(ficha)} titulo={ficha?.nombre || ''} subtitulo={ficha?.email || undefined} onCerrar={() => setAbierto(null)}>
        {ficha && (
          <div className={s.ficha}>
            <dl className={s.datos}>
              {ficha.telefono && <div><dt>Teléfono</dt><dd>{ficha.telefono}</dd></div>}
              {ficha.cumpleanos && <div><dt>Su cumpleaños</dt><dd>{fechaDeDia(ficha.cumpleanos) || ficha.cumpleanos}</dd></div>}
              {ficha.basicos.map((b) => <div key={b.label}><dt>{b.label}</dt><dd>{b.valor}</dd></div>)}
              {ficha.aQuien.length > 0 && <div><dt>Regala a</dt><dd>{ficha.aQuien.join(', ')}</dd></div>}
            </dl>
            <h3 className={s.paso}>Sus personas ({ficha.personas.length})</h3>
            {ficha.personas.length ? ficha.personas.map((p, i) => (
              <section key={`${p.nombre}-${i}`} className={s.persona}>
                <strong>{p.nombre} <span className={s.nota}>· {p.relacion}{p.genero ? ` · ${p.genero}` : ''}</span></strong>
                {p.fechas.length > 0 && <span className={s.nota}>{p.fechas.join(' · ')}</span>}
                {p.presupuesto && <span className={s.nota}>Presupuesto: {p.presupuesto}</span>}
                {p.gustos.length ? p.gustos.map((g) => (
                  <span key={g.conjunto} className={s.gusto}><strong>{g.conjunto}:</strong> {g.respuestas.length ? g.respuestas.map((x) => x.valor).join(' · ') : 'marcado, sin respuestas'}</span>
                )) : <span className={s.nota}>Sin gustos.</span>}
              </section>
            )) : <SinDatos>No anotó personas.</SinDatos>}
          </div>
        )}
      </HojaEdicion>
      <Confirmar
        abierta={Boolean(reactivar)}
        titulo="¿Volver a hacer esta pregunta?"
        texto={reactivar ? `«${reactivar.nombre}» vuelve a salir en la encuesta. Sus respuestas de antes se suman a las nuevas.` : ''}
        confirmar="Volver a preguntarla"
        onCancelar={() => setReactivar(null)}
        onConfirmar={async () => {
          try {
            await onVolverAPreguntar?.(reactivar.que);
            toast({ tipo: 'exito', titulo: 'Listo: vuelve a salir en la encuesta', texto: reactivar.nombre });
          } catch (err) {
            toast({ tipo: 'error', titulo: 'No se pudo', texto: errorDe(err) });
          } finally {
            setReactivar(null);
          }
        }}
      />
    </div>
  );
}

/**
 * Las reseñas que dejan los clientes en la ficha de cada producto
 * (product_reviews). Antes no se veían en ningún lado del admin y no había
 * cómo quitar una falsa o repetida (las reglas ya dejaban borrarlas a un admin).
 *  - resenas: [{ id, producto, productoUrl, estrellas, comentario, nombre, fecha (ms), fotos: [url] }]
 *  - cargando · error · onReintentar · onBorrar(id) → promesa
 */
export function PaginaResenasProductos({ resenas = [], cargando, error, onReintentar, onBorrar }) {
  const toast = useToast();
  const [visibles, setVisibles] = useState(30);
  const [borrar, setBorrar] = useState(null);
  // La que se está borrando: se encoge y se va mientras el servidor la quita.
  const [saliendo, setSaliendo] = useState(null);
  const total = resenas.length;
  const promedio = total ? Math.round((resenas.reduce((n, r) => n + (Number(r.estrellas) || 0), 0) / total) * 10) / 10 : 0;
  const confirmarBorrar = async () => {
    const x = borrar;
    setBorrar(null);
    setSaliendo(x.id);
    try {
      await onBorrar(x.id);
      toast({ tipo: 'exito', titulo: 'Reseña borrada', texto: x.producto || undefined });
    } catch (err) {
      setSaliendo(null);
      toast({ tipo: 'error', titulo: 'No se borró', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  if (error) return <Aviso tipo="error" titulo="No se pudieron leer las reseñas" accion={onReintentar ? <Boton tamano="sm" variante="secundario" onClick={onReintentar}>Reintentar</Boton> : undefined}>{error}</Aviso>;
  return (
    <div data-componente="PaginaResenasProductos">
      <FilaCifras>
        <Cifra nombre="Reseñas" valor={total} cargando={cargando} />
        <Cifra nombre="Promedio" valor={total ? `${promedio} ★` : '—'} tono="aviso" cargando={cargando} />
      </FilaCifras>
      <BloqueMetrica titulo="Lo que escriben en cada producto" ayuda="Todas, de la más nueva a la más vieja. Borrar una la quita de la ficha del producto.">
        {cargando ? <EsqueletoTexto lineas={4} /> : total ? (
          <ul className={s.comentarios}>
            {resenas.slice(0, visibles).map((x, i) => (
              <li
                key={x.id}
                className={[s.comentario, s.resena, saliendo === x.id && s.resenaSale].filter(Boolean).join(' ')}
                // En cascada, las primeras 8 (las que llegan con «Cargar más» también).
                style={{ '--k': i % 30 }}
              >
                <span className={s.comentarioCabeza}>
                  <span className={s.estrellas} aria-label={`${x.estrellas} de 5 estrellas`}>{estrellasTexto(x.estrellas)}</span>
                  <span className={s.nota}>
                    {x.productoUrl ? <a href={x.productoUrl} target="_blank" rel="noreferrer">{x.producto || 'Producto'}</a> : (x.producto || 'Producto sin nombre')}
                    {x.fecha ? ` · ${fecha(x.fecha)}` : ''}
                  </span>
                </span>
                {x.comentario && <p>{x.comentario}</p>}
                {x.fotos?.length > 0 && <span className={s.nota}>{x.fotos.length} foto{x.fotos.length === 1 ? '' : 's'}: {x.fotos.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer">{i ? ', ' : ''}ver {i + 1}</a>)}</span>}
                <span className={s.comentarioCabeza}>
                  <span className={s.nota}>{x.nombre || 'Anónimo'}</span>
                  {onBorrar && <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => setBorrar(x)}>Borrar</Boton>}
                </span>
              </li>
            ))}
          </ul>
        ) : <SinDatos>Todavía nadie dejó una reseña.</SinDatos>}
        <CargarMas visibles={Math.min(visibles, total)} total={total} paso={30} onMas={() => setVisibles((v) => v + 30)} unidad={['reseña', 'reseñas']} />
      </BloqueMetrica>
      <Confirmar
        abierta={Boolean(borrar)}
        titulo="¿Borrar esta reseña?"
        texto={borrar ? `Se quita de la ficha de ${borrar.producto || 'ese producto'}. No se puede deshacer.` : ''}
        confirmar="Borrar"
        peligro
        onConfirmar={confirmarBorrar}
        onCancelar={() => setBorrar(null)}
      />
    </div>
  );
}
