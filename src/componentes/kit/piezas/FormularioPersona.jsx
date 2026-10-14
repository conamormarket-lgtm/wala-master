import React, { useRef, useState } from 'react';
import { Plus, Trash2, Camera } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, HojaInferior } from '../Feedback';
import { Campo, Interruptor, Casilla } from '../Formulario';
import { CampoFecha } from '../Fecha';
import { Avatar } from './Avatar';
import { RecortarFoto } from './RecortarFoto';
import s from './FormularioPersona.module.css';

/*
 * El formulario de una persona a la que se le regala (Fechas importantes y la
 * encuesta). Los datos tienen la forma de personaDesdeRecipient
 * (adaptadores): { id, nombre, genero, relacion, presupuesto, foto, gustos,
 * familia: { activo, q1, q2, q3 }, eventos: [{ id, tipo, nombre, fecha }] }.
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

let siguienteId = 0;
const nuevoId = () => { siguienteId += 1; return `f${Date.now().toString(36)}${siguienteId}`; };

/** Reglas de una persona (las de saveRecipient). Devuelve el primer error o ''. */
export function validarPersona(p) {
  if (!String(p.nombre || '').trim()) return 'Falta el nombre de la persona.';
  if (!p.genero) return 'Falta elegir el género.';
  for (let i = 0; i < p.eventos.length; i += 1) {
    const e = p.eventos[i];
    const cual = i === 0 ? 'Cumpleaños' : (e.tipo === 'Fecha Especial' ? (e.nombre || 'Fecha especial') : e.tipo);
    if (i > 0 && e.tipo === 'Fecha Especial' && !String(e.nombre || '').trim()) return 'Escribe qué se celebra en la fecha especial.';
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
function useFormularioPersona({ inicial, conjuntos = [], onGuardar, onCerrar, onSubirFoto, relacionFija = false, familia = false, textoGuardar = 'Guardar' }) {
  const [p, setP] = useState(() => ({
    nombre: '', genero: '', relacion: 'otros', presupuesto: '', foto: null, gustos: {}, familia: { activo: false },
    ...inicial,
    eventos: (inicial?.eventos?.length ? inicial.eventos : [{ id: nuevoId(), tipo: 'Cumpleaños', fecha: '' }]).map((e) => ({ ...e })),
  }));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const poner = (campo) => (e) => setP((x) => ({ ...x, [campo]: e.target.value }));
  const ponerEvento = (i, campo, valor) => setP((x) => ({ ...x, eventos: x.eventos.map((e, k) => (k === i ? { ...e, [campo]: valor } : e)) }));
  const guardar = async () => {
    const msg = validarPersona(p);
    setError(msg);
    if (msg) return;
    setGuardando(true);
    try {
      await onGuardar({ ...p, eventos: p.eventos.map(({ id, tipo, nombre, fecha }, i) => ({ id, tipo: i === 0 ? 'Cumpleaños' : tipo, nombre, fecha })) });
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
  return {
    pie: (
      <div className={s.pieForm}>
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <div className={s.botonesForm}>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando || subiendo}>Cancelar</Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={subiendo}>{textoGuardar}</Boton>
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
            <button type="button" className={s.fotoBoton} onClick={() => archivo.current?.click()} disabled={subiendo} aria-label={p.foto ? 'Cambiar la foto' : 'Subir una foto'}>
              <Avatar className={s.fotoAvatar} nombre={p.nombre} imagen={p.foto} letras={1}><Plus aria-hidden="true" /></Avatar>
              <span className={s.fotoCamara} aria-hidden="true"><Camera /></span>
            </button>
            <div className={s.fotoTextos}>
              <span className={s.fotoBotones}>
                <Boton tamano="sm" icono={<Camera aria-hidden="true" />} cargando={subiendo} onClick={() => archivo.current?.click()}>
                  {p.foto ? 'Cambiar foto' : 'Subir foto'}
                </Boton>
                {p.foto && <Boton variante="fantasma" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={() => setP((x) => ({ ...x, foto: null }))}>Quitar</Boton>}
              </span>
              <small>Opcional. Ayuda a reconocerla de un vistazo.</small>
            </div>
          </div>
        )}
        <div className={s.fila}>
          <Campo etiqueta="Nombre de la persona" value={p.nombre} onChange={poner('nombre')} placeholder="Ej. Carlos" />
          <Campo etiqueta="Género" opciones={GENEROS} value={p.genero} onChange={poner('genero')} />
        </div>
        {!relacionFija && (
          <Campo etiqueta="Relación" opciones={RELACIONES} value={p.relacion} onChange={poner('relacion')}
            ayuda="Con la relación y el género sumamos las fechas del calendario que le tocan (Día de la Madre, del Padre, de la Amistad…)." />
        )}
        <Campo etiqueta="¿Cuánto sueles gastar en su regalo?" opciones={PRESUPUESTOS} value={p.presupuesto} onChange={poner('presupuesto')}
          ayuda="Para que las ideas entren en tu presupuesto." />

        {(conjuntos.length > 0 || familia) && (
          <fieldset className={s.grupoForm}>
            <legend>¿Qué le gusta a {p.nombre || 'esta persona'}?</legend>
            <p className={s.ayudaGrupo}>Opcional, pero es lo que más mejora las ideas de regalo.</p>
            {familia && (
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
            )}
            {conjuntos.map((c) => {
              const activo = Boolean(p.gustos[c.id]);
              return (
                <div key={c.id} className={s.gusto}>
                  <Interruptor
                    activo={activo}
                    etiqueta={c.nombre}
                    onChange={(v) => setP((x) => {
                      const gustos = { ...x.gustos };
                      if (v) gustos[c.id] = gustos[c.id] || {}; else delete gustos[c.id];
                      return { ...x, gustos };
                    })}
                  />
                  {activo && (c.campos || []).map((campo) => (
                    <Campo
                      key={campo.id}
                      etiqueta={campo.etiqueta}
                      opciones={campo.opciones
                        ? [{ valor: '', texto: 'Elige…', deshabilitada: true }, ...campo.opciones.map((o) => ({ valor: o, texto: o }))]
                        : (campo.sugerencias || []).map((o) => ({ valor: o, texto: o }))}
                      creable={!campo.opciones}
                      placeholder={campo.opciones ? undefined : 'Escribe o elige una sugerencia'}
                      value={p.gustos[c.id]?.[campo.id] || ''}
                      onChange={(e) => setP((x) => ({ ...x, gustos: { ...x.gustos, [c.id]: { ...x.gustos[c.id], [campo.id]: e.target.value } } }))}
                    />
                  ))}
                </div>
              );
            })}
          </fieldset>
        )}

        <fieldset className={s.grupoForm}>
          <legend>Fechas de esta persona</legend>
          {p.eventos.map((e, i) => (
            <div key={e.id} className={s.evento}>
              <div className={s.eventoCabeza}>
                {i === 0 ? <strong>Cumpleaños</strong> : (
                  <Campo etiqueta="Tipo" opciones={TIPOS_FECHA} value={e.tipo === 'Cumpleaños' ? 'Aniversario' : e.tipo} onChange={(ev) => ponerEvento(i, 'tipo', ev.target.value)} />
                )}
                {i > 0 && (
                  <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Quitar esta fecha" icono={<Trash2 aria-hidden="true" />}
                    onClick={() => setP((x) => ({ ...x, eventos: x.eventos.filter((_, k) => k !== i) }))} />
                )}
              </div>
              {i > 0 && e.tipo === 'Fecha Especial' && (
                <Campo etiqueta="¿Qué se celebra?" value={e.nombre || ''} onChange={(ev) => ponerEvento(i, 'nombre', ev.target.value)} placeholder="Ej. Bautizo" />
              )}
              <CampoFecha
                etiqueta={i === 0 ? 'Fecha de su cumpleaños' : 'Fecha'}
                valor={e.fecha}
                onCambiar={(iso) => ponerEvento(i, 'fecha', iso)}
                anioOpcional
                vistaInicial={i === 0 ? 'anios' : 'dias'}
                max={i === 0 ? new Date().toISOString().slice(0, 10) : undefined}
                ayuda={i === 0 ? 'Si no sabes en qué año nació, marca «No sé el año».' : undefined}
              />
            </div>
          ))}
          <Boton variante="contorno" tamano="sm" icono={<Plus aria-hidden="true" />}
            onClick={() => setP((x) => ({ ...x, eventos: [...x.eventos, { id: nuevoId(), tipo: 'Aniversario', fecha: '' }] }))}>
            Agregar otra fecha
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
 */
export function HojaPersona({ persona, abierta, onCerrar, titulo, ...resto }) {
  const formulario = useFormularioPersona({ inicial: persona, onCerrar, ...resto });
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={titulo || (persona?.id ? `Editar a ${persona.nombre}` : 'Añadir persona')} pie={formulario.pie}>
      {formulario.cuerpo}
    </HojaInferior>
  );
}
