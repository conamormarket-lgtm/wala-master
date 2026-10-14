import React, { useState } from 'react';
import {
  Gift, UserRound, Users, UsersRound, Heart, Baby, House, Smile, Handshake, Plus, ArrowLeft, ArrowRight,
  Check, CalendarHeart, LogIn, RotateCcw,
} from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { Campo } from '../Formulario';
import { CampoFecha } from '../Fecha';
import { Moneda, GananciaMonedas } from '../Etiquetas';
import { Sello, Trazo, Garabatos } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion } from '../Seccion';
import { ProgresoEncuesta, ElegirVarios, FichaPersonaEncuesta } from '../piezas/Encuesta';
import { HojaPersona, validarPersona } from '../piezas/FormularioPersona';
import { IdeaRegalo } from '../piezas/Regalos';
import { Hueso, EsqueletoFormulario } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import s from './Encuesta.module.css';

/*
 * La encuesta del perfil de regalos (/encuesta-suscripcion): portada, un poco
 * sobre ti, a quiénes regalas y, grupo por grupo, los datos de cada persona.
 * Al terminar, las monedas ganadas y las primeras ideas de regalo.
 * Va dentro de MarcoTienda. Datos por props (encuestaDesdeConfig y
 * personaDesdeRecipient en adaptadores).
 */

/** Los grupos de "¿A quiénes sueles regalar?" (roleKey de la encuesta). */
export const GRUPOS_ENCUESTA = [
  { valor: 'pareja', texto: 'Pareja', plural: 'Tu pareja', singular: 'Pareja', Icono: Heart, tono: 'rosa', unico: true },
  { valor: 'hijos', texto: 'Hijos', plural: 'Tus hijos', singular: 'Hijo/a', Icono: Baby },
  { valor: 'padres', texto: 'Padres', plural: 'Tus padres', singular: 'Padre/Madre', Icono: House },
  { valor: 'hermanos', texto: 'Hermanos', plural: 'Tus hermanos', singular: 'Hermano/a', Icono: Users },
  { valor: 'sobrinos', texto: 'Sobrinos', plural: 'Tus sobrinos', singular: 'Sobrino/a', Icono: Smile },
  { valor: 'primos', texto: 'Primos', plural: 'Tus primos', singular: 'Primo/a', Icono: UsersRound },
  { valor: 'amigos', texto: 'Amigos', plural: 'Tus amigos', singular: 'Amigo/a', Icono: Handshake },
  { valor: 'otros', texto: 'Otros', plural: 'Otras personas', singular: 'Otra persona', Icono: UserRound },
];
const grupoDe = (valor) => GRUPOS_ENCUESTA.find((g) => g.valor === valor) || GRUPOS_ENCUESTA[GRUPOS_ENCUESTA.length - 1];

/** Los textos por defecto (DEFAULT_SURVEY_CONFIG de encuestaConfig.js). */
export const CONFIG_ENCUESTA = {
  portada: {
    titulo: '¡Queremos conocerte mejor!',
    subtitulo: 'Tus respuestas nos ayudarán a darte una experiencia increíble.',
    textoEmpezar: 'Empezar encuesta',
    textoOmitir: 'No, gracias',
  },
  sobreTi: {
    titulo: 'Un poco sobre ti',
    subtitulo: 'Queremos saber qué te gusta.',
    campos: [
      { id: 'nombres', etiqueta: '¿Cómo te llamas?', tipo: 'texto', requerido: true },
    ],
  },
  gracias: {
    titulo: '¡Muchas gracias!',
    mensaje: 'Hemos guardado tus preferencias con éxito. Ahora tu experiencia será mucho más personalizada.',
    textoBoton: 'Ir a la tienda',
  },
};

/** Los textos por defecto con los de la config encima (sin pisar con vacíos). */
const unir = (base, extra = {}) => ({ ...base, ...Object.fromEntries(Object.entries(extra || {}).filter(([, v]) => v != null && v !== '')) });

/** La cabeza de cada paso: sello con su ícono (si hay), título de marca y subtítulo. */
function CabezaPaso({ Icono, tono, titulo, subtitulo, trazo = false }) {
  return (
    <header className={s.cabeza}>
      {Icono && <Sello tamano={52} tono={tono} girar={-8}><Icono aria-hidden="true" /></Sello>}
      <h1 className={s.titulo}>
        {titulo}
        {trazo && <Trazo className={s.trazo} />}
      </h1>
      {subtitulo && <p className={s.subtitulo}>{subtitulo}</p>}
    </header>
  );
}

/** La fila de botones de abajo de cada paso (atrás a la izquierda, seguir a la derecha). */
function Acciones({ children, centro = false }) {
  return <div className={[s.acciones, centro && s.accionesCentro].filter(Boolean).join(' ')}>{children}</div>;
}

/**
 * La encuesta completa, paso a paso. Las personas se guardan en esta página
 * hasta "Terminar encuesta"; recién ahí sale onTerminar.
 *  - config: textos y preguntas (CONFIG_ENCUESTA; encuestaDesdeConfig)
 *  - conjuntos: gustos que se pueden marcar (los de HojaPersona)
 *  - inicial: { respuestas, cumpleanos, grupos: [valor], personas } lo que ya
 *    tiene el perfil (al volver a responder no se pierde nada)
 *  - recompensa: { base: 15, porFecha: 5, tope: 50 } · sesion · completada
 *  - cargando · urlLogin · urlRegistro · urlFechas · urlTienda
 *  - onOmitir(): "No, gracias" (marca la fecha del aviso y va al inicio)
 *  - onTerminar({ respuestas, cumpleanos, grupos, personas, quitadas }):
 *    promesa → { monedas, ideas: [{ id, nombre, ideas: [props de IdeaRegalo] }] }
 *  - onSubirFoto(blob) → url · onAgregarIdea(idea)
 */
export function PaginaEncuesta({
  config = CONFIG_ENCUESTA, conjuntos = [], inicial = {}, recompensa = { base: 15, porFecha: 5, tope: 50 },
  sesion = true, completada = false, cargando = false,
  urlLogin = '/login', urlRegistro = '/registro', urlFechas = '/cuenta/fechas-importantes', urlTienda = '/',
  onOmitir, onTerminar, onSubirFoto, onAgregarIdea,
}) {
  const portada = unir(CONFIG_ENCUESTA.portada, config.portada);
  const sobreTi = unir(CONFIG_ENCUESTA.sobreTi, config.sobreTi);
  const gracias = unir(CONFIG_ENCUESTA.gracias, config.gracias);

  const [rehacer, setRehacer] = useState(false);
  const [paso, setPaso] = useState(0);
  // Hacia dónde entra el paso nuevo (la animación de entrada).
  const [sentido, setSentido] = useState('adelante');
  const [respuestas, setRespuestas] = useState(() => ({ ...inicial.respuestas }));
  const [cumpleanos, setCumpleanos] = useState(inicial.cumpleanos || '');
  const [grupos, setGrupos] = useState(() => inicial.grupos || []);
  const [personas, setPersonas] = useState(() => inicial.personas || []);
  const [quitadas, setQuitadas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [errores, setErrores] = useState({});
  // Aviso del paso: { tipo, texto, accion } en vez de alert/confirm.
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [fin, setFin] = useState(null);
  const [hoja, setHoja] = useState({ abierta: false, persona: null, clave: 0 });
  const [agregadas, setAgregadas] = useState([]);

  const ir = (n, haciaAtras = false) => {
    setSentido(haciaAtras ? 'atras' : 'adelante');
    setAviso(null);
    setPaso(n);
  };
  const orden = GRUPOS_ENCUESTA.map((g) => g.valor).filter((v) => grupos.includes(v));
  const grupo = grupoDe(orden[indice]);
  const delGrupo = personas.filter((p) => p.relacion === grupo.valor);

  if (cargando) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
        <div className={s.columna} aria-busy="true">
          <Hueso forma="pildora" alto={30} />
          <div className={s.tarjeta}><EsqueletoFormulario campos={3} /></div>
        </div>
      </BloqueSeccion>
    );
  }

  if (!sesion || (completada && !rehacer && paso === 0)) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={`${s.columna} ${s.estado}`}>
          {!sesion ? (
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Cuéntanos a quién le regalas" texto={`Inicia sesión para responder la encuesta y ganar hasta ${recompensa.tope} monedas.`}>
              <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>
              <Boton to={urlRegistro} variante="contorno">Crear cuenta</Boton>
            </EstadoVacio>
          ) : (
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo="Ya respondiste la encuesta" texto="Tus personas y sus fechas están en Fechas importantes. Puedes volver a responderla: no se pierde nada de lo que ya guardaste.">
              <Boton to={urlFechas} icono={<CalendarHeart aria-hidden="true" />}>Ver mis fechas</Boton>
              <Boton variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={() => setRehacer(true)}>Volver a responder</Boton>
            </EstadoVacio>
          )}
        </div>
      </BloqueSeccion>
    );
  }

  /* ── Avanzar ──────────────────────────────────────────── */

  const seguirSobreTi = () => {
    const faltan = {};
    (sobreTi.campos || []).forEach((c) => { if (c.requerido && !String(respuestas[c.id] || '').trim()) faltan[c.id] = 'Completa este dato para seguir.'; });
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    ir(2);
  };

  const terminar = async () => {
    setGuardando(true);
    setAviso(null);
    try {
      const listas = personas.filter((p) => !validarPersona(p));
      const r = await onTerminar?.({ respuestas, cumpleanos, grupos, personas: listas, quitadas });
      setFin({ monedas: r?.monedas || 0, ideas: r?.ideas || [] });
      ir(4);
    } catch {
      setAviso({ tipo: 'error', texto: 'No pudimos guardar tus respuestas. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const seguirGrupos = () => {
    if (!orden.length) {
      setAviso({
        tipo: 'info',
        texto: 'Elige al menos un grupo. Si por ahora no le regalas a nadie, puedes terminar igual.',
        accion: <Boton tamano="sm" variante="contorno" onClick={terminar} cargando={guardando}>Terminar sin personas</Boton>,
      });
      return;
    }
    setIndice(0);
    ir(3);
  };

  const siguienteGrupo = (sinNadie = false) => {
    if (grupo.unico && !delGrupo.length) {
      setAviso({ tipo: 'error', texto: 'Completa los datos de tu pareja, o vuelve y desmárcala.' });
      return;
    }
    if (delGrupo.some((p) => validarPersona(p))) {
      setAviso({ tipo: 'error', texto: 'Hay personas con datos por completar: toca cada una para terminar (nombre, género y fechas).' });
      return;
    }
    if (!delGrupo.length && !sinNadie) {
      setAviso({
        tipo: 'info',
        texto: `No agregaste a nadie en ${grupo.texto.toLowerCase()}. ¿Sigues igual?`,
        accion: <Boton tamano="sm" variante="contorno" onClick={() => siguienteGrupo(true)}>Seguir sin nadie</Boton>,
      });
      return;
    }
    if (indice + 1 < orden.length) {
      setSentido('adelante');
      setAviso(null);
      setIndice(indice + 1);
    } else {
      terminar();
    }
  };

  const grupoAnterior = () => {
    if (indice === 0) { ir(2, true); return; }
    setSentido('atras');
    setAviso(null);
    setIndice(indice - 1);
  };

  const abrir = (persona) => setHoja((h) => ({ abierta: true, persona, clave: h.clave + 1 }));
  const guardarPersona = async (p) => {
    const id = p.id || `nueva${Date.now().toString(36)}`;
    setPersonas((l) => (l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? { ...p, id } : x)) : [...l, { ...p, id }]));
    setAviso(null);
  };
  const quitar = (p) => {
    setPersonas((l) => l.filter((x) => x.id !== p.id));
    if (!String(p.id).startsWith('nueva')) setQuitadas((q) => [...q, p.id]);
  };

  /* ── Avance arriba ────────────────────────────────────── */

  let avance = paso / 4;
  if (paso === 3) avance = 0.75 + (indice / Math.max(1, orden.length)) * 0.25;
  if (paso === 4) avance = 1;
  const clavePaso = paso === 3 ? `g-${grupo.valor}` : `p-${paso}`;

  let cuerpo;
  if (paso === 0) {
    cuerpo = (
      <>
        <div className={s.portada}>
          <img className={s.kapi} src={CARAS_KAPI.feliz} alt="" width="132" height="132" />
          {/* Sin sello: Kapi ya pone la cara. */}
          <CabezaPaso titulo={portada.titulo} subtitulo={portada.subtitulo} trazo />
        </div>
        <div className={s.premio}>
          <Moneda tamano={30} className={s.premioMoneda} />
          <p>
            <strong>Gana {recompensa.base} monedas</strong> al terminar y <strong>{recompensa.porFecha} más</strong> por cada fecha importante
            que registres (hasta {recompensa.tope}). Úsalas como descuento en tus compras.
          </p>
        </div>
        <p className={s.texto}>Completa esta encuesta para recibir recomendaciones y regalos a la medida de cada persona. Es muy rápido: 3 pasos.</p>
        <Acciones centro>
          <Boton variante="fantasma" onClick={onOmitir}>{portada.textoOmitir}</Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => ir(1)}>{portada.textoEmpezar}</Boton>
        </Acciones>
      </>
    );
  } else if (paso === 1) {
    cuerpo = (
      <>
        <CabezaPaso Icono={UserRound} titulo={sobreTi.titulo} subtitulo={sobreTi.subtitulo} />
        <div className={s.formulario}>
          {(sobreTi.campos || []).map((c) => (
            <Campo
              key={c.id}
              id={`encuesta-${c.id}`}
              etiqueta={c.etiqueta}
              error={errores[c.id]}
              opciones={c.tipo === 'opciones' ? [{ valor: '', texto: 'Elige…', deshabilitada: true }, ...(c.opciones || []).map((o) => ({ valor: o, texto: o }))] : undefined}
              value={respuestas[c.id] || ''}
              onChange={(e) => { const v = e.target.value; setRespuestas((r) => ({ ...r, [c.id]: v })); setErrores((x) => ({ ...x, [c.id]: undefined })); }}
            />
          ))}
          <CampoFecha
            id="encuesta-cumpleanos"
            etiqueta="Tu cumpleaños"
            ayuda="Opcional."
            valor={cumpleanos}
            onCambiar={setCumpleanos}
            vistaInicial="anios"
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => ir(0, true)}>Atrás</Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={seguirSobreTi}>Continuar</Boton>
        </Acciones>
      </>
    );
  } else if (paso === 2) {
    cuerpo = (
      <>
        <CabezaPaso Icono={Users} titulo="¿A quiénes sueles regalar?" subtitulo="Elige todos los que quieras. Después nos cuentas de cada uno." />
        <ElegirVarios etiqueta="A quiénes sueles regalar" opciones={GRUPOS_ENCUESTA} valores={grupos} onCambiar={(v) => { setGrupos(v); setAviso(null); }} />
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => ir(1, true)}>Atrás</Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={seguirGrupos}>
            {orden.length ? `Continuar · ${orden.length} ${orden.length === 1 ? 'grupo' : 'grupos'}` : 'Continuar'}
          </Boton>
        </Acciones>
      </>
    );
  } else if (paso === 3) {
    const ultimo = indice + 1 >= orden.length;
    cuerpo = (
      <>
        <span className={s.grupoDe}>Grupo {indice + 1} de {orden.length}</span>
        <CabezaPaso Icono={grupo.Icono} tono={grupo.tono} titulo={grupo.plural}
          subtitulo={grupo.unico ? 'Cuéntanos de tu pareja: te avisamos de sus fechas y te damos ideas a su medida.' : 'Agrega a cada uno: te avisamos de sus fechas y te damos ideas a su medida.'} />
        <p className={s.porFecha}>
          <GananciaMonedas>+{recompensa.porFecha} por cada fecha nueva</GananciaMonedas>
        </p>
        <ul className={s.personas}>
          {delGrupo.map((p) => (
            <FichaPersonaEncuesta
              key={p.id}
              nombre={p.nombre}
              relacion={grupo.singular}
              foto={p.foto}
              completa={!validarPersona(p)}
              onEditar={() => abrir(p)}
              onQuitar={grupo.unico ? undefined : () => quitar(p)}
            />
          ))}
          {grupo.unico && !delGrupo.length && (
            <FichaPersonaEncuesta relacion="Pareja" onEditar={() => abrir({ relacion: grupo.valor })} />
          )}
        </ul>
        {!grupo.unico && (
          <button type="button" className={s.anadir} onClick={() => abrir({ relacion: grupo.valor })}>
            <Plus aria-hidden="true" /> Añadir {grupo.singular.toLowerCase()}
          </button>
        )}
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={grupoAnterior}>{indice === 0 ? 'Atrás' : 'Grupo anterior'}</Boton>
          <Boton iconoFin={!ultimo && <ArrowRight aria-hidden="true" />} icono={ultimo && <Check aria-hidden="true" />} cargando={guardando} onClick={() => siguienteGrupo()}>
            {ultimo ? 'Terminar encuesta' : 'Siguiente grupo'}
          </Boton>
        </Acciones>
      </>
    );
  } else {
    const conIdeas = (fin?.ideas || []).filter((x) => x.ideas?.length).slice(0, 3);
    cuerpo = (
      <>
        <CabezaPaso Icono={Check} tono="menta" titulo={gracias.titulo} subtitulo={gracias.mensaje} trazo />
        {fin?.monedas > 0 && (
          <div className={s.ganaste}>
            <Moneda tamano={30} className={s.premioMoneda} />
            <p><strong>Ganaste {fin.monedas} monedas.</strong> Ya están en tu saldo.</p>
          </div>
        )}
        {conIdeas.length > 0 && (
          <section className={s.ideas} aria-labelledby="encuesta-ideas">
            <h2 id="encuesta-ideas" className={s.ideasTitulo}><Gift aria-hidden="true" /> Ya tenemos ideas de regalo</h2>
            {conIdeas.map((x) => (
              <div key={x.id} className={s.ideasPersona}>
                <p className={s.ideasPara}>Para {x.nombre}</p>
                <ul className={s.ideasLista}>
                  {x.ideas.slice(0, 3).map((i) => (
                    <IdeaRegalo
                      key={i.id}
                      {...i}
                      agregada={i.agregada || agregadas.includes(i.id)}
                      onAgregar={() => { setAgregadas((a) => [...a, i.id]); onAgregarIdea?.(i); }}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
        <p className={s.consejo}>
          <CalendarHeart aria-hidden="true" />
          <span>
            Desde ahora puedes agregar personas y fechas en <Enlace to={urlFechas} className={s.consejoEnlace}>Fechas importantes</Enlace>, dentro de tu cuenta.
          </span>
        </p>
        <Acciones centro>
          <Boton to={urlTienda} iconoFin={<ArrowRight aria-hidden="true" />}>{gracias.textoBoton}</Boton>
        </Acciones>
      </>
    );
  }

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.columna}>
        {paso > 0 && <ProgresoEncuesta texto={paso === 4 ? '¡Listo!' : `Paso ${Math.min(paso, 3)} de 3`} avance={avance} />}
        <div key={clavePaso} className={[s.tarjeta, sentido === 'atras' ? s.entraAtras : s.entraAdelante].join(' ')}>
          <Garabatos variante="titulo" className={s.garabatos} />
          {cuerpo}
          {/* Encima de los botones (la fila de botones va última por CSS). */}
          {aviso && (
            <div className={s.avisoPaso}>
              <Aviso tipo={aviso.tipo} compacto accion={aviso.accion}>{aviso.texto}</Aviso>
            </div>
          )}
        </div>
      </div>
      {paso === 3 && (
        <HojaPersona
          key={hoja.clave}
          abierta={hoja.abierta}
          persona={hoja.persona}
          conjuntos={conjuntos}
          familia
          relacionFija
          titulo={hoja.persona?.id ? `Datos de ${hoja.persona.nombre || grupo.singular.toLowerCase()}` : `Añadir ${grupo.singular.toLowerCase()}`}
          textoGuardar={`Guardar ${grupo.unico ? 'a tu pareja' : grupo.singular.toLowerCase()}`}
          onGuardar={guardarPersona}
          onSubirFoto={onSubirFoto}
          onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))}
        />
      )}
    </BloqueSeccion>
  );
}
