import React, { useRef, useState } from 'react';
import { Plus, Trash2, Camera } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, HojaInferior } from '../Feedback';
import { Campo, Interruptor, Casilla } from '../Formulario';
import { Chip } from '../Etiquetas';
import { CampoFecha } from '../Fecha';
import { Avatar } from './Avatar';
import { RecortarFoto } from './RecortarFoto';
import { ElegirUno } from './Encuesta';
import { Texto, useTexto } from '../Traduccion';
import s from './FormularioPersona.module.css';

/*
 * El formulario de una persona a la que se le regala (Fechas importantes y la
 * encuesta). Los datos tienen la forma de personaDesdeRecipient
 * (adaptadores): { id, nombre, genero, relacion, presupuesto, foto, gustos,
 * gustosApagados, familia: { activo, q1, q2, q3 }, eventos: [{ id, tipo,
 * nombre, fecha }] }.
 *  - gustos: los conjuntos marcados con sus respuestas; gustosApagados: las
 *    respuestas de los que se apagaron (no se pierden: vuelven al prenderlo)
 *  - el cumpleaños va fijo arriba solo si la primera fecha ES un cumpleaños;
 *    el tipo de cada fecha se guarda tal cual
 */

export const RELACIONES = [
  { valor: 'pareja', texto: 'Pareja' }, { valor: 'hijos', texto: 'Hijo/a' }, { valor: 'padres', texto: 'Padre/Madre' },
  { valor: 'hermanos', texto: 'Hermano/a' }, { valor: 'sobrinos', texto: 'Sobrino/a' }, { valor: 'primos', texto: 'Primo/a' },
  { valor: 'amigos', texto: 'Amigo/a' }, { valor: 'otros', texto: 'Otra persona' },
];
export const GENEROS = [{ valor: '', texto: 'Elige…', deshabilitada: true }, { valor: 'Femenino', texto: 'Femenino' }, { valor: 'Masculino', texto: 'Masculino' }, { valor: 'Otro', texto: 'Otro' }];
export const PRESUPUESTOS = [
  { valor: '', texto: 'Sin preferencia' }, { valor: 'hasta50', texto: 'Hasta S/ 50' }, { valor: '50a100', texto: 'S/ 50 – 100' },
  { valor: '100a200', texto: 'S/ 100 – 200' }, { valor: 'mas200', texto: 'Más de S/ 200' },
];
const TIPOS_FECHA = [{ valor: 'Aniversario', texto: 'Aniversario' }, { valor: 'Fecha Especial', texto: 'Fecha especial' }];
// Un cumpleaños que no está arriba (datos de antes) se puede ver y cambiar.
const tiposPara = (tipo) => (tipo === 'Cumpleaños' ? [{ valor: 'Cumpleaños', texto: 'Cumpleaños' }, ...TIPOS_FECHA] : TIPOS_FECHA);
/** ¿Es la fila fija del cumpleaños? (la primera, si es un cumpleaños) */
const esFijo = (e, i) => i === 0 && e.tipo === 'Cumpleaños';

let siguienteId = 0;
const nuevoId = () => { siguienteId += 1; return `f${Date.now().toString(36)}${siguienteId}`; };

/** Reglas de una persona (las de saveRecipient). Devuelve el primer error o ''. */
export function validarPersona(p) {
  if (!String(p.nombre || '').trim()) return 'Falta el nombre de la persona.';
  if (!p.genero) return 'Falta elegir el género.';
  for (const e of p.eventos) {
    const cual = e.tipo === 'Fecha Especial' ? (e.nombre || 'Fecha especial') : e.tipo;
    if (e.tipo === 'Fecha Especial' && !String(e.nombre || '').trim()) return 'Escribe qué se celebra en la fecha especial.';
    if (!e.fecha) return `Falta la fecha de "${cual}".`;
  }
  return '';
}

/** Las tres preguntas del "Conjunto familia" (familySet de la encuesta). */
const preguntasFamilia = (genero) => [
  ['q1', genero === 'Masculino' ? 'Es para él' : genero === 'Femenino' ? 'Es para ella' : 'Es para él o ella'],
  ['q2', 'Es para ambos'],
  ['q3', 'Es para más personas'],
];

/** Estado y partes (cuerpo y pie) del formulario de una persona, para la hoja. */
function useFormularioPersona({ inicial, conjuntos = [], onGuardar, onCerrar, onSubirFoto, relacionFija = false, familia = false, presupuesto = true, gustosEnBotones = false, textoGuardar = 'Guardar' }) {
  const [p, setP] = useState(() => ({
    nombre: '', genero: '', relacion: 'otros', presupuesto: '', foto: null, gustos: {}, gustosApagados: {}, familia: { activo: false },
    ...inicial,
    eventos: (inicial?.eventos?.length ? inicial.eventos : [{ id: nuevoId(), tipo: 'Cumpleaños', fecha: '' }]).map((e) => ({ ...e })),
  }));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const poner = (campo) => (e) => setP((x) => ({ ...x, [campo]: e.target.value }));
  const ponerEvento = (i, campo, valor) => setP((x) => ({ ...x, eventos: x.eventos.map((e, k) => (k === i ? { ...e, [campo]: valor } : e)) }));
  // Apagar un gusto no borra lo respondido: queda aparte y vuelve al prenderlo.
  const alternarGusto = (id, v) => setP((x) => {
    const gustos = { ...x.gustos };
    const apagados = { ...x.gustosApagados };
    if (v) { gustos[id] = gustos[id] || apagados[id] || {}; delete apagados[id]; } else { if (gustos[id] && Object.keys(gustos[id]).length) apagados[id] = gustos[id]; delete gustos[id]; }
    return { ...x, gustos, gustosApagados: apagados };
  });
  const bloqueFamilia = familia && (
    <div className={s.gusto}>
      <Interruptor
        activo={Boolean(p.familia?.activo)}
        etiqueta="Conjunto familia"
        descripcion="Regalos para compartir en casa."
        onChange={(v) => setP((x) => ({ ...x, familia: { ...x.familia, activo: v } }))}
      />
      {p.familia?.activo && (
        <div className={s.casillas}>
          {preguntasFamilia(p.genero).map(([clave, texto]) => (
            <Casilla
              key={clave}
              etiqueta={texto}
              activo={Boolean(p.familia?.[clave])}
              onChange={(v) => setP((x) => ({ ...x, familia: { ...x.familia, [clave]: v } }))}
            />
          ))}
        </div>
      )}
    </div>
  );
  const ponerGusto = (c, campo, valor) => setP((x) => ({ ...x, gustos: { ...x.gustos, [c.id]: { ...x.gustos[c.id], [campo.id]: valor } } }));
  // En la encuesta corta las de opción se responden con un toque (ElegirUno).
  const preguntasGusto = (c) => (c.campos || []).map((campo) => (gustosEnBotones && campo.opciones ? (
    <ElegirUno key={campo.id} etiqueta={campo.etiqueta} opciones={campo.opciones} valor={p.gustos[c.id]?.[campo.id] || ''} onCambiar={(v) => ponerGusto(c, campo, v)} />
  ) : (
    <Campo
      key={campo.id}
      etiqueta={campo.etiqueta}
      opciones={campo.opciones
        ? [{ valor: '', texto: 'Elige…', deshabilitada: true }, ...campo.opciones.map((o) => ({ valor: o, texto: o }))]
        : (campo.sugerencias || []).map((o) => ({ valor: o, texto: o }))}
      creable={!campo.opciones}
      placeholder={campo.opciones ? undefined : 'Escribe o elige una sugerencia'}
      value={p.gustos[c.id]?.[campo.id] || ''}
      onChange={(e) => ponerGusto(c, campo, e.target.value)}
    />
  )));
  const guardar = async () => {
    const msg = validarPersona(p);
    setError(msg);
    if (msg) return;
    setGuardando(true);
    try {
      await onGuardar({ ...p, eventos: p.eventos.map(({ id, tipo, nombre, fecha }) => ({ id, tipo, nombre, fecha })) });
      onCerrar();
    } catch {
      setError('No pudimos guardar los cambios. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };
  // La foto pasa por el recorte (otra hoja encima de esta) antes de subirse.
  const [recorte, setRecorte] = useState(null);
  const archivo = useRef(null);
  const elegirFoto = (archivo) => {
    if (!archivo?.type?.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return; }
    setError('');
    setRecorte(URL.createObjectURL(archivo));
  };
  const subirFoto = async (blob) => {
    setSubiendo(true);
    try {
      const url = await onSubirFoto(blob);
      setP((x) => ({ ...x, foto: url }));
      setRecorte(null);
    } catch {
      setError('No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };
  // Solo los aria-label propios: Campo, CampoFecha e Interruptor traducen lo que reciben.
  const t = {
    quitarFecha: useTexto('Quitar esta fecha'),
    foto: useTexto(p.foto ? 'Cambiar la foto' : 'Subir una foto'),
  };
  return {
    ocupado: guardando || subiendo,
    pie: (
      <div className={s.pieForm}>
        {error && <Aviso tipo="error" compacto><Texto>{error}</Texto></Aviso>}
        <div className={s.botonesForm}>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando || subiendo}><Texto>Cancelar</Texto></Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={subiendo}><Texto>{textoGuardar}</Texto></Boton>
        </div>
      </div>
    ),
    cuerpo: (
      <div className={s.formulario}>
        {onSubirFoto && (
          <RecortarFoto
            abierta={Boolean(recorte)}
            src={recorte}
            titulo="Recorta su foto"
            onCancelar={() => setRecorte(null)}
            onListo={subirFoto}
          />
        )}
        {onSubirFoto && (
          <div className={s.fotoPersona}>
            <input ref={archivo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; elegirFoto(f); }} />
            {/* La foto también se toca (con su cámara en la esquina, como en Mi perfil). */}
            <button type="button" className={s.fotoBoton} onClick={() => archivo.current?.click()} disabled={subiendo} aria-label={t.foto}>
              <Avatar className={s.fotoAvatar} nombre={p.nombre} imagen={p.foto} letras={1}><Plus aria-hidden="true" /></Avatar>
              <span className={s.fotoCamara} aria-hidden="true"><Camera /></span>
            </button>
            <div className={s.fotoTextos}>
              <span className={s.fotoBotones}>
                <Boton tamano="sm" icono={<Camera aria-hidden="true" />} cargando={subiendo} onClick={() => archivo.current?.click()}>
                  <Texto>{p.foto ? 'Cambiar foto' : 'Subir foto'}</Texto>
                </Boton>
                {p.foto && <Boton variante="fantasma" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={() => setP((x) => ({ ...x, foto: null }))} disabled={subiendo}><Texto>Quitar</Texto></Boton>}
              </span>
              <small><Texto>Opcional. Ayuda a reconocerla de un vistazo.</Texto></small>
            </div>
          </div>
        )}
        <div className={s.fila}>
          <Campo etiqueta="Nombre de la persona" value={p.nombre} onChange={poner('nombre')} placeholder="Ej. Carlos" />
          <Campo etiqueta="Género" opciones={GENEROS} value={p.genero} onChange={poner('genero')} />
        </div>
        {!relacionFija && (
          <Campo etiqueta="Relación" opciones={RELACIONES} value={p.relacion} onChange={poner('relacion')} ayuda="Con la relación y el género sumamos las fechas del calendario que le tocan (Día de la Madre, del Padre, de la Amistad…)." />
        )}
        {presupuesto && (
          <Campo etiqueta="¿Cuánto sueles gastar en su regalo?" opciones={PRESUPUESTOS} value={p.presupuesto} onChange={poner('presupuesto')} ayuda="Para que las ideas entren en tu presupuesto." />
        )}

        {/* Encuesta corta: los gustos son botones y cada uno abre a lo más una pregunta. */}
        {gustosEnBotones && (conjuntos.length > 0 || familia) && (
          <fieldset className={s.grupoForm}>
            <legend><Texto>{`¿A ${p.nombre || 'esta persona'} le gusta algo de esto?`}</Texto></legend>
            <p className={s.ayudaGrupo}><Texto>Opcional. Con esto las ideas de regalo le atinan mejor.</Texto></p>
            <div className={s.chipsGusto}>
              {conjuntos.map((c) => (
                <Chip key={c.id} activo={Boolean(p.gustos[c.id])} onClick={() => alternarGusto(c.id, !p.gustos[c.id])}>
                  <Texto>{c.nombre}</Texto>
                </Chip>
              ))}
            </div>
            {conjuntos.filter((c) => p.gustos[c.id]).map(preguntasGusto)}
            {bloqueFamilia}
          </fieldset>
        )}

        {!gustosEnBotones && (conjuntos.length > 0 || familia) && (
          <fieldset className={s.grupoForm}>
            <legend><Texto>{`¿Qué le gusta a ${p.nombre || 'esta persona'}?`}</Texto></legend>
            <p className={s.ayudaGrupo}><Texto>Opcional, pero es lo que más mejora las ideas de regalo.</Texto></p>
            {bloqueFamilia}
            {conjuntos.map((c) => {
              const activo = Boolean(p.gustos[c.id]);
              return (
                <div key={c.id} className={s.gusto}>
                  <Interruptor activo={activo} etiqueta={c.nombre} onChange={(v) => alternarGusto(c.id, v)} />
                  {activo && preguntasGusto(c)}
                </div>
              );
            })}
          </fieldset>
        )}

        <fieldset className={s.grupoForm}>
          <legend><Texto>Fechas de esta persona</Texto></legend>
          {p.eventos.map((e, i) => {
            const cumple = e.tipo === 'Cumpleaños';
            return (
              <div key={e.id} className={s.evento}>
                <div className={s.eventoCabeza}>
                  {esFijo(e, i) ? <strong><Texto>Cumpleaños</Texto></strong> : (
                    <Campo etiqueta="Tipo" opciones={tiposPara(e.tipo)} value={e.tipo} onChange={(ev) => ponerEvento(i, 'tipo', ev.target.value)} />
                  )}
                  {!esFijo(e, i) && (
                    <Boton variante="fantasma" tamano="sm" soloIcono aria-label={t.quitarFecha} icono={<Trash2 aria-hidden="true" />}
                      onClick={() => setP((x) => ({ ...x, eventos: x.eventos.filter((_, k) => k !== i) }))} />
                  )}
                </div>
                {e.tipo === 'Fecha Especial' && (
                  <Campo etiqueta="¿Qué se celebra?" value={e.nombre || ''} onChange={(ev) => ponerEvento(i, 'nombre', ev.target.value)} placeholder="Ej. Bautizo" />
                )}
                <CampoFecha
                  etiqueta={cumple ? 'Fecha de nacimiento' : 'Fecha'}
                  valor={e.fecha}
                  onCambiar={(iso) => ponerEvento(i, 'fecha', iso)}
                  anioOpcional={cumple}
                  soloDiaMes={!cumple}
                  vistaInicial={cumple ? 'anios' : 'meses'}
                  max={cumple ? new Date().toISOString().slice(0, 10) : undefined}
                  ayuda={cumple ? 'El año es opcional. Si no lo sabes, marca «No sé el año».' : undefined}
                />
              </div>
            );
          })}
          <Boton variante="contorno" tamano="sm" icono={<Plus aria-hidden="true" />}
            onClick={() => setP((x) => ({ ...x, eventos: [...x.eventos, { id: nuevoId(), tipo: 'Aniversario', fecha: '' }] }))}>
            <Texto>Agregar otra fecha</Texto>
          </Boton>
        </fieldset>
      </div>
    ),
  };
}

/**
 * Formulario de una persona a la que se le regala, en una hoja inferior
 * (ventana en escritorio): foto con recorte, nombre, género, relación,
 * presupuesto, gustos (conjuntos de la encuesta, con sugerencias) y sus
 * fechas (cumpleaños fijo; aniversarios y fechas especiales con calendario).
 * Lo usan Fechas importantes y la encuesta.
 *  - abierta, onCerrar · persona: la que se edita ({} = nueva)
 *  - conjuntos: [{ id, nombre, campos: [{ id, etiqueta, opciones | sugerencias }] }]
 *  - onGuardar(persona): promesa · onSubirFoto(blob) → url
 *  - relacionFija: sin el campo Relación (la encuesta ya la sabe)
 *  - familia: con el "Conjunto familia" (sus tres casillas) · titulo, textoGuardar
 *  - presupuesto: con la pregunta del presupuesto (la encuesta corta va sin ella)
 *  - gustosEnBotones: los gustos como botones en una fila (encuesta corta) en
 *    vez de un interruptor por conjunto
 */
export function HojaPersona({ persona, abierta, onCerrar, titulo, ...resto }) {
  const formulario = useFormularioPersona({ inicial: persona, onCerrar, ...resto });
  return (
    // Mientras guarda o sube la foto no se cierra (perder el formulario a mitad es peor que esperar).
    <HojaInferior abierta={abierta} onCerrar={onCerrar} bloqueada={formulario.ocupado} titulo={titulo || (persona?.id ? `Editar a ${persona.nombre}` : 'Añadir persona')} pie={formulario.pie}>
      {formulario.cuerpo}
    </HojaInferior>
  );
}
