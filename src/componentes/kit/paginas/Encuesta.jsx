import React, { useEffect, useState } from 'react';
import {
  Gift, UserRound, Users, UsersRound, Heart, Baby, House, Smile, Handshake, Plus, ArrowLeft, ArrowRight,
  Check, CalendarHeart, LogIn, RotateCcw, MessageCircle,
} from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { Campo } from '../Formulario';
import { CampoFecha } from '../Fecha';
import { Moneda, GananciaMonedas } from '../Etiquetas';
import { Sello, Trazo, Garabatos } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion } from '../Seccion';
import { ProgresoEncuesta, ElegirVarios, ElegirUno, FichaPersonaEncuesta } from '../piezas/Encuesta';
import { HojaPersona, validarPersona } from '../piezas/FormularioPersona';
import { IdeaRegalo } from '../piezas/Regalos';
import { Hueso, EsqueletoFormulario } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { preguntaVisible, cambiarRespuestaEncuesta } from '../../../services/encuestaOrigen.mjs';
import s from './Encuesta.module.css';

/*
 * La encuesta del perfil de regalos (/encuesta-suscripcion): portada, un poco
 * sobre ti, a quiénes regalas y, grupo por grupo, los datos de cada persona.
 * Al terminar, las monedas ganadas y las primeras ideas de regalo.
 * Va dentro de MarcoTienda. Datos por props (encuestaDesdeConfig y
 * personaDesdeRecipient en adaptadores). Los textos (también los del admin)
 * pasan por la traducción.
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
    texto: 'Completa esta encuesta para recibir recomendaciones y regalos a la medida de cada persona. Toma unos 2 minutos.',
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
        <Texto>{titulo}</Texto>
        {trazo && <Trazo className={s.trazo} />}
      </h1>
      {subtitulo && <p className={s.subtitulo}><Texto>{subtitulo}</Texto></p>}
    </header>
  );
}

/** Una pregunta de "Un poco sobre ti" (Campo traduce la etiqueta y el error; las opciones van traducidas). */
function PreguntaSobreTi({ campo, valor, error, onCambiar }) {
  const elige = useTexto('Elige…');
  if (campo.fuente === 'marcas') {
    const opciones = [...new Set([...(campo.opciones || []), ...(valor ? [valor] : [])])];
    return (
      <Campo
        id={`encuesta-${campo.id}`}
        etiqueta={campo.etiqueta}
        opciones={[{ valor: '', texto: elige, deshabilitada: true }, ...opciones.map((o) => ({ valor: o, texto: o }))]}
        value={valor || ''}
        onChange={(e) => onCambiar(e.target.value)}
        disabled={!opciones.length}
        ayuda={!opciones.length ? 'No hay marcas disponibles por ahora. Puedes continuar sin elegir una.' : undefined}
        error={error && <Texto>{error}</Texto>}
      />
    );
  }
  // Las de opción se responden con un toque.
  if (campo.tipo === 'opciones') {
    return (
      <div>
        <ElegirUno etiqueta={campo.etiqueta} opciones={campo.opciones || []} valor={valor || ''} onCambiar={onCambiar} />
        {error && <p className={s.errorPregunta} role="alert"><Texto>{error}</Texto></p>}
      </div>
    );
  }
  return (
    <Campo
      id={`encuesta-${campo.id}`}
      etiqueta={campo.etiqueta}
      error={error && <Texto>{error}</Texto>}
      opciones={campo.tipo === 'opciones' ? [{ valor: '', texto: elige, deshabilitada: true }, ...(campo.opciones || []).map((o) => ({ valor: o, texto: o }))] : undefined}
      value={valor || ''}
      onChange={(e) => onCambiar(e.target.value)}
    />
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
 *  - onEmpezar(): al dejar la portada (la tienda pide ahí lo que necesitan
 *    las personas y las ideas: en la portada no hace falta el catálogo)
 *  - nombreCuenta: el nombre de la cuenta. Con él no se pregunta "¿Cómo te
 *    llamas?" (se guarda igual en las respuestas). El cumpleaños solo se
 *    pregunta si no viene en inicial; sin nada que preguntar, el paso
 *    "Un poco sobre ti" se salta.
 *  - onPaso(paso): cada paso que se muestra (embudo): portada, sobre_ti,
 *    grupos, personas (una vez al entrar a los grupos), whatsapp, terminada
 *  - pedirWhatsapp: al final, "¿Te avisamos de promociones por WhatsApp?"
 *    (si dice que no, "¿Estás seguro?"); la respuesta sale en onTerminar
 *    como whatsapp: true | false (sin el paso, undefined)
 *  - Lo que decide el admin (encuestaDesdeConfig): las preguntas con
 *    enEncuesta: false no salen (lo respondido antes se conserva);
 *    config.persona: { presupuesto, familia } en la hoja de cada persona;
 *    config.portada.texto: el texto de la portada.
 */
export function PaginaEncuesta({
  config = CONFIG_ENCUESTA, conjuntos = [], inicial = {}, recompensa = { base: 15, porFecha: 5, tope: 50 },
  sesion = true, completada = false, cargando = false,
  urlLogin = '/login', urlRegistro = '/registro', urlFechas = '/cuenta/fechas-importantes', urlTienda = '/',
  onOmitir, onTerminar, onSubirFoto, onAgregarIdea, onEmpezar, nombreCuenta = '', pedirWhatsapp = false, onPaso,
}) {
  const portada = unir(CONFIG_ENCUESTA.portada, config.portada);
  const sobreTi = unir(CONFIG_ENCUESTA.sobreTi, config.sobreTi);
  const gracias = unir(CONFIG_ENCUESTA.gracias, config.gracias);

  const [rehacer, setRehacer] = useState(false);
  const [paso, setPaso] = useState(0);
  // Hacia dónde entra el paso nuevo (la animación de entrada).
  const [sentido, setSentido] = useState('adelante');
  const [respuestas, setRespuestas] = useState(() => ({
    ...inicial.respuestas,
    ...(String(nombreCuenta).trim() && { nombres: String(nombreCuenta).trim() }),
  }));
  // Qué se pregunta en "Un poco sobre ti" se decide al abrir: no cambia a mitad.
  const [pedir] = useState(() => ({ nombre: !String(nombreCuenta).trim(), cumple: !inicial.cumpleanos }));
  const camposSobreTi = (sobreTi.campos || [])
    .filter((c) => preguntaVisible(c, respuestas, sobreTi.campos) && (c.id !== 'nombres' || pedir.nombre));
  // Cada gusto con solo las preguntas que el admin deja en la encuesta.
  const gustos = conjuntos.map((c) => ({ ...c, campos: (c.campos || []).filter((f) => f.enEncuesta !== false) }));
  const conSobreTi = camposSobreTi.length > 0 || pedir.cumple;
  const totalPasos = conSobreTi ? 3 : 2;
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
  const t = {
    progreso: useTexto(paso === 4 ? '¡Listo!' : `Paso ${Math.min(Math.max(conSobreTi ? paso : paso - 1, 1), totalPasos)} de ${totalPasos}`),
    // El enlace va dentro de la frase: se busca ya traducido en la frase traducida.
    fechas: useTexto('Fechas importantes'),
  };
  const empezo = paso > 0;
  useEffect(() => { if (empezo) onEmpezar?.(); }, [empezo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Embudo: cada paso que se ve (la pantalla de "ya respondiste" no cuenta como portada).
  useEffect(() => {
    if (!sesion || cargando || (paso === 0 && completada && !rehacer)) return;
    onPaso?.({ 0: 'portada', 1: 'sobre_ti', 2: 'grupos', 3: 'personas', 3.5: 'whatsapp', 4: 'terminada' }[paso]);
  }, [paso, rehacer, sesion, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>Cuéntanos a quién le regalas</Texto>} texto={<Texto>{`Inicia sesión para responder la encuesta y ganar hasta ${recompensa.tope} monedas.`}</Texto>}>
              <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
              <Boton to={urlRegistro} variante="contorno"><Texto>Crear cuenta</Texto></Boton>
            </EstadoVacio>
          ) : (
            <EstadoVacio imagen={CARAS_KAPI.feliz} titulo={<Texto>Ya respondiste la encuesta</Texto>} texto={<Texto>Tus personas y sus fechas están en Fechas importantes. Puedes volver a responderla: no se pierde nada de lo que ya guardaste.</Texto>}>
              <Boton to={urlFechas} icono={<CalendarHeart aria-hidden="true" />}><Texto>Ver mis fechas</Texto></Boton>
              <Boton variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={() => setRehacer(true)}><Texto>Volver a responder</Texto></Boton>
            </EstadoVacio>
          )}
        </div>
      </BloqueSeccion>
    );
  }

  /* ── Avanzar ──────────────────────────────────────────── */

  const seguirSobreTi = () => {
    const faltan = {};
    camposSobreTi.forEach((c) => {
      if (c.fuente === 'marcas' && !c.opciones?.length) return;
      if (c.requerido && !String(respuestas[c.id] || '').trim()) faltan[c.id] = 'Completa este dato para seguir.';
    });
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    ir(2);
  };

  const terminar = async (whatsapp) => {
    setGuardando(true);
    setAviso(null);
    try {
      const listas = personas.filter((p) => !validarPersona(p));
      const r = await onTerminar?.({ respuestas, cumpleanos, grupos, personas: listas, quitadas, whatsapp });
      setFin({ monedas: r?.monedas || 0, ideas: r?.ideas || [] });
      ir(4);
    } catch {
      setAviso({ tipo: 'error', texto: 'No pudimos guardar tus respuestas. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  // Al final, la pregunta de WhatsApp (si toca); si no, se guarda de una vez.
  const alFinal = () => (pedirWhatsapp ? ir(3.5) : terminar());
  const noWhatsapp = () => setAviso({
    tipo: 'aviso',
    texto: '¿Estás seguro? Te perderías descuentos exclusivos y los avisos de productos nuevos.',
    accion: <Boton tamano="sm" variante="contorno" onClick={() => terminar(false)} cargando={guardando}><Texto>Sí, estoy seguro</Texto></Boton>,
  });

  const seguirGrupos = () => {
    if (!orden.length) {
      setAviso({
        tipo: 'info',
        texto: 'Elige al menos un grupo. Si por ahora no le regalas a nadie, puedes terminar igual.',
        accion: <Boton tamano="sm" variante="contorno" onClick={alFinal} cargando={guardando}><Texto>Terminar sin personas</Texto></Boton>,
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
        accion: <Boton tamano="sm" variante="contorno" onClick={() => siguienteGrupo(true)}><Texto>Seguir sin nadie</Texto></Boton>,
      });
      return;
    }
    if (indice + 1 < orden.length) {
      setSentido('adelante');
      setAviso(null);
      setIndice(indice + 1);
    } else {
      alFinal();
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
            <TextoResaltado resaltar={[`Gana ${recompensa.base} monedas`, `${recompensa.porFecha} más`]}>
              {`Gana ${recompensa.base} monedas al terminar y ${recompensa.porFecha} más por cada fecha importante que registres (hasta ${recompensa.tope}). Úsalas como descuento en tus compras.`}
            </TextoResaltado>
          </p>
        </div>
        <p className={s.texto}><Texto>{portada.texto}</Texto></p>
        <Acciones centro>
          <Boton variante="fantasma" onClick={onOmitir}><Texto>{portada.textoOmitir}</Texto></Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => ir(conSobreTi ? 1 : 2)}><Texto>{portada.textoEmpezar}</Texto></Boton>
        </Acciones>
      </>
    );
  } else if (paso === 1) {
    cuerpo = (
      <>
        <CabezaPaso Icono={UserRound} titulo={sobreTi.titulo} subtitulo={camposSobreTi.length ? sobreTi.subtitulo : 'Así te saludamos en tu día.'} />
        <div className={s.formulario}>
          {camposSobreTi.map((c) => (
            <PreguntaSobreTi
              key={c.id}
              campo={c}
              valor={respuestas[c.id]}
              error={errores[c.id]}
              onCambiar={(v) => { setRespuestas((r) => cambiarRespuestaEncuesta(r, c.id, v)); setErrores((x) => ({ ...x, [c.id]: undefined })); }}
            />
          ))}
          {pedir.cumple && (
            <CampoFecha
              id="encuesta-cumpleanos"
              etiqueta="Fecha de nacimiento"
              ayuda="Opcional."
              valor={cumpleanos}
              onCambiar={setCumpleanos}
              vistaInicial="anios"
              max={new Date().toISOString().slice(0, 10)}
            />
          )}
        </div>
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => ir(0, true)}><Texto>Atrás</Texto></Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={seguirSobreTi}><Texto>Continuar</Texto></Boton>
        </Acciones>
      </>
    );
  } else if (paso === 2) {
    cuerpo = (
      <>
        <CabezaPaso Icono={Users} titulo="¿A quiénes sueles regalar?" subtitulo="Elige todos los que quieras. Después nos cuentas de cada uno." />
        <ElegirVarios etiqueta="A quiénes sueles regalar" opciones={GRUPOS_ENCUESTA} valores={grupos} onCambiar={(v) => { setGrupos(v); setAviso(null); }} />
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => ir(conSobreTi ? 1 : 0, true)}><Texto>Atrás</Texto></Boton>
          <Boton iconoFin={<ArrowRight aria-hidden="true" />} onClick={seguirGrupos}>
            <Texto>{orden.length ? `Continuar · ${orden.length} ${orden.length === 1 ? 'grupo' : 'grupos'}` : 'Continuar'}</Texto>
          </Boton>
        </Acciones>
      </>
    );
  } else if (paso === 3) {
    const ultimo = indice + 1 >= orden.length;
    cuerpo = (
      <>
        <span className={s.grupoDe}><Texto>{`Grupo ${indice + 1} de ${orden.length}`}</Texto></span>
        <CabezaPaso Icono={grupo.Icono} tono={grupo.tono} titulo={grupo.plural}
          subtitulo={grupo.unico ? 'Cuéntanos de tu pareja: te avisamos de sus fechas y te damos ideas a su medida.' : 'Agrega a cada uno: te avisamos de sus fechas y te damos ideas a su medida.'} />
        <p className={s.porFecha}>
          <GananciaMonedas><Texto>{`+${recompensa.porFecha} por cada fecha nueva`}</Texto></GananciaMonedas>
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
            <Plus aria-hidden="true" /> <Texto>{`Añadir ${grupo.singular.toLowerCase()}`}</Texto>
          </button>
        )}
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={grupoAnterior}><Texto>{indice === 0 ? 'Atrás' : 'Grupo anterior'}</Texto></Boton>
          <Boton iconoFin={!ultimo && <ArrowRight aria-hidden="true" />} icono={ultimo && <Check aria-hidden="true" />} cargando={guardando} onClick={() => siguienteGrupo()}>
            <Texto>{ultimo ? 'Terminar encuesta' : 'Siguiente grupo'}</Texto>
          </Boton>
        </Acciones>
      </>
    );
  } else if (paso === 3.5) {
    cuerpo = (
      <>
        <CabezaPaso
          Icono={MessageCircle}
          tono="menta"
          titulo="¿Te avisamos de promociones por WhatsApp?"
          subtitulo="Descuentos y novedades directo a tu celular. Puedes desactivarlo cuando quieras en Mi perfil."
        />
        <div className={s.opcionesWhatsapp}>
          <Boton bloque icono={<Check aria-hidden="true" />} onClick={() => terminar(true)} cargando={guardando}><Texto>Sí, quiero recibirlas</Texto></Boton>
          <Boton bloque variante="contorno" onClick={noWhatsapp} disabled={guardando}><Texto>No, gracias</Texto></Boton>
        </div>
        <Acciones>
          <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={() => ir(orden.length ? 3 : 2, true)}><Texto>Atrás</Texto></Boton>
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
            <p><strong><Texto>{`Ganaste ${fin.monedas} monedas.`}</Texto></strong> <Texto>Ya están en tu saldo.</Texto></p>
          </div>
        )}
        {conIdeas.length > 0 && (
          <section className={s.ideas} aria-labelledby="encuesta-ideas">
            <h2 id="encuesta-ideas" className={s.ideasTitulo}><Gift aria-hidden="true" /> <Texto>Ya tenemos ideas de regalo</Texto></h2>
            {conIdeas.map((x) => (
              <div key={x.id} className={s.ideasPersona}>
                <p className={s.ideasPara}><Texto>{`Para ${x.nombre}`}</Texto></p>
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
            <TextoResaltado resaltar={[t.fechas]} envolver={(parte, k) => <Enlace key={k} to={urlFechas} className={s.consejoEnlace}>{parte}</Enlace>}>
              Desde ahora puedes agregar personas y fechas en Fechas importantes, dentro de tu cuenta.
            </TextoResaltado>
          </span>
        </p>
        <Acciones centro>
          <Boton to={urlTienda} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>{gracias.textoBoton}</Texto></Boton>
        </Acciones>
      </>
    );
  }

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.columna}>
        {paso > 0 && <ProgresoEncuesta texto={t.progreso} avance={avance} />}
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
          conjuntos={gustos}
          presupuesto={Boolean(config.persona?.presupuesto)}
          familia={Boolean(config.persona?.familia)}
          gustosEnBotones
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
