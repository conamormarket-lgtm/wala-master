// /admin/popups — popups de campaña (encuesta, promos, Live, referidos…).
// Todo se guarda en un solo documento: storeConfig/popups.
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { getEstadisticasPopup, getPopups, reiniciarEstadoLocal, savePopups } from '../../services/popups';
import { OPCIONES, POPUP_VACIO, idDesdeNombre, normalizarPopup } from '../../services/popupsLogic.mjs';
import { uploadFile } from '../../services/firebase/storage';
import PopupCard from '../../components/common/CampaignPopup/PopupCard';
import styles from './AdminPopups.module.css';

const etiqueta = (campo, valor) => OPCIONES[campo].find((o) => o.value === valor)?.label || valor;

const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

const describirCuando = (p) => {
  if (p.disparador === 'scroll') return `al bajar ${p.scrollPct}%`;
  if (p.disparador === 'salida') return 'al intentar salir';
  return p.segundos > 0 ? `a los ${p.segundos} s` : 'apenas entra';
};

const Estadisticas = ({ popupId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-popup-stats', popupId],
    queryFn: () => getEstadisticasPopup(popupId),
    staleTime: 60 * 1000,
  });
  if (isLoading) return <p className={styles.nota}>Cargando métricas…</p>;
  if (error) return <p className={styles.nota}>No se pudieron cargar las métricas.</p>;
  return (
    <dl className={styles.stats}>
      <div><dt>Vistas</dt><dd>{data.vistas}</dd></div>
      <div><dt>Clics</dt><dd>{data.clics} <small>{pct(data.clics, data.vistas)}</small></dd></div>
      <div><dt>Cerrados</dt><dd>{data.cierres}</dd></div>
      <div><dt>Conversiones</dt><dd>{data.conversiones} <small>{pct(data.conversiones, data.clics)}</small></dd></div>
    </dl>
  );
};

const Campo = ({ label, ayuda, children }) => (
  <label className={styles.campo}>
    <span className={styles.campoLabel}>{label}</span>
    {children}
    {ayuda && <span className={styles.ayuda}>{ayuda}</span>}
  </label>
);

const Select = ({ campo, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {OPCIONES[campo].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Editor = ({ inicial, idsExistentes, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [errorImagen, setErrorImagen] = useState('');
  const [previa, setPrevia] = useState(false);
  const esNuevo = !inicial.id;
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const setInput = (campo) => (e) => set(campo)(e.target.value);

  const subirImagen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setErrorImagen('');
    const { url, error } = await uploadFile(file, `config/popups/${Date.now()}_${file.name}`);
    setSubiendo(false);
    if (error) setErrorImagen(error);
    else set('imagenUrl')(url);
  };

  const enviar = (e) => {
    e.preventDefault();
    const id = form.id || idDesdeNombre(form.nombre || form.titulo, idsExistentes);
    onGuardar(normalizarPopup({ ...form, id }));
  };

  const esImagen = form.formato === 'imagen';
  const valido = form.titulo.trim()
    && (esImagen ? form.imagenUrl.trim() : form.botonTexto.trim())
    && (form.objetivo === 'encuesta' || form.botonUrl.trim());

  return (
    <form className={styles.editor} onSubmit={enviar}>
      <div className={styles.editorHead}>
        <h2>{esNuevo ? 'Nuevo popup' : `Editar: ${inicial.nombre || inicial.titulo}`}</h2>
        <label className={styles.switch}>
          <input type="checkbox" checked={form.activo} onChange={(e) => set('activo')(e.target.checked)} />
          <span>{form.activo ? 'Activo' : 'Apagado'}</span>
        </label>
      </div>

      <fieldset className={styles.grupo}>
        <legend>Contenido</legend>
        <Campo label="Nombre interno" ayuda="Solo lo ves tú, para reconocerlo en la lista.">
          <input value={form.nombre} onChange={setInput('nombre')} placeholder="Ej. Encuesta octubre" />
        </Campo>
        <Campo
          label="Formato"
          ayuda={esImagen
            ? 'Se muestra solo la imagen; al tocarla, hace lo que diga “¿Qué hace el botón?”. Pon todo el mensaje dentro de la imagen.'
            : 'Título, texto y un botón; la imagen es opcional y va arriba.'}
        >
          <Select campo="formato" value={form.formato} onChange={set('formato')} />
        </Campo>
        <Campo
          label={esImagen ? 'Descripción de la imagen' : 'Título'}
          ayuda={esImagen ? 'No se ve: la leen los lectores de pantalla. Resume lo que dice la imagen.' : null}
        >
          <input value={form.titulo} onChange={setInput('titulo')} required maxLength={120} />
        </Campo>
        {!esImagen && (
          <Campo label="Texto">
            <textarea value={form.texto} onChange={setInput('texto')} rows={3} maxLength={400} />
          </Campo>
        )}
        <Campo
          label={esImagen ? 'Imagen' : 'Imagen (opcional)'}
          ayuda={esImagen
            ? 'Cuadrada o vertical se ve bien en celular. Puedes subirla o pegar un enlace.'
            : 'Horizontal, 16:9. Puedes subirla o pegar un enlace.'}
        >
          <div className={styles.fila}>
            <input value={form.imagenUrl} onChange={setInput('imagenUrl')} placeholder="https://…" />
            <label className={styles.btnSecundario}>
              {subiendo ? 'Subiendo…' : 'Subir'}
              <input type="file" accept="image/*" hidden onChange={subirImagen} disabled={subiendo} />
            </label>
          </div>
          {errorImagen && <span className={styles.error}>{errorImagen}</span>}
          {form.imagenUrl && <img className={styles.miniatura} src={form.imagenUrl} alt="" />}
        </Campo>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>{esImagen ? 'Al tocar la imagen' : 'Botón'}</legend>
        <Campo
          label={esImagen ? '¿A dónde lleva?' : '¿Qué hace el botón?'}
          ayuda={form.objetivo === 'encuesta'
            ? 'Lleva a la encuesta (o a iniciar sesión si no la tiene). No se muestra a quien ya la llenó, y completarla cuenta como conversión.'
            : 'Lleva al enlace que pongas. Puede ser una página de la tienda (/ofertas) o un enlace externo.'}
        >
          <Select campo="objetivo" value={form.objetivo} onChange={set('objetivo')} />
        </Campo>
        <div className={styles.dosCol}>
          {!esImagen && (
            <Campo label="Texto del botón">
              <input value={form.botonTexto} onChange={setInput('botonTexto')} required maxLength={40} />
            </Campo>
          )}
          {form.objetivo === 'enlace' && (
            <Campo label="Enlace">
              <input value={form.botonUrl} onChange={setInput('botonUrl')} placeholder="/ofertas" required />
            </Campo>
          )}
        </div>
        {!esImagen && (
          <Campo label="Texto para cerrar" ayuda="Déjalo vacío para mostrar solo la ×.">
            <input value={form.cerrarTexto} onChange={setInput('cerrarTexto')} maxLength={40} />
          </Campo>
        )}
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>A quién y dónde</legend>
        <div className={styles.tresCol}>
          <Campo label="Audiencia"><Select campo="audiencia" value={form.audiencia} onChange={set('audiencia')} /></Campo>
          <Campo label="Páginas"><Select campo="paginas" value={form.paginas} onChange={set('paginas')} /></Campo>
          <Campo label="Dispositivo"><Select campo="dispositivo" value={form.dispositivo} onChange={set('dispositivo')} /></Campo>
        </div>
        <p className={styles.nota}>Nunca aparece en carrito, pago, login, admin, la encuesta ni el editor.</p>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>Cuándo</legend>
        <div className={styles.tresCol}>
          <Campo label="Aparece"><Select campo="disparador" value={form.disparador} onChange={set('disparador')} /></Campo>
          {form.disparador === 'scroll' ? (
            <Campo label="% de la página">
              <input type="number" min={5} max={100} value={form.scrollPct} onChange={setInput('scrollPct')} />
            </Campo>
          ) : (
            <Campo
              label="Segundos en el sitio"
              ayuda={form.disparador === 'salida' ? 'En celular se usa esto.' : '0 = apenas entra.'}
            >
              <input type="number" min={0} max={600} value={form.segundos} onChange={setInput('segundos')} />
            </Campo>
          )}
          <Campo label="No repetir por (días)" ayuda="Tras verlo, no se le vuelve a mostrar a esa persona.">
            <input type="number" min={0} max={365} value={form.cooldownDias} onChange={setInput('cooldownDias')} />
          </Campo>
        </div>
        <div className={styles.tresCol}>
          <Campo label="Desde (opcional)"><input type="date" value={form.desde} onChange={setInput('desde')} /></Campo>
          <Campo label="Hasta (opcional)"><input type="date" value={form.hasta} onChange={setInput('hasta')} /></Campo>
          <Campo label="Prioridad" ayuda="Si aplican varios, sale el de número más alto.">
            <input type="number" value={form.prioridad} onChange={setInput('prioridad')} />
          </Campo>
        </div>
        <p className={styles.nota}>Como máximo se muestra un popup por visita.</p>
      </fieldset>

      <div className={styles.editorAcciones}>
        <button type="button" className={styles.btnSecundario} onClick={() => setPrevia(true)} disabled={!valido}>
          <Eye size={16} /> Vista previa
        </button>
        <span className={styles.espaciador} />
        <button type="button" className={styles.btnSecundario} onClick={onCancelar}>Cancelar</button>
        <button type="submit" className={styles.btnPrimario} disabled={!valido || guardando || subiendo}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {previa && (
        <PopupCard popup={normalizarPopup(form)} onCta={() => setPrevia(false)} onClose={() => setPrevia(false)} />
      )}
    </form>
  );
};

const AdminPopups = () => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(null); // popup | null
  const [previa, setPrevia] = useState(null);
  const [aviso, setAviso] = useState('');

  const { data: popups = [], isLoading, error } = useQuery({
    queryKey: ['admin-popups'],
    queryFn: async () => {
      const { data, error: err } = await getPopups();
      // Si no se pudo leer, no dejamos editar: guardar pisaría lo que haya.
      if (err) throw new Error(err);
      return data;
    },
    staleTime: 0,
  });

  const guardar = useMutation({
    mutationFn: async (lista) => {
      const { error: err } = await savePopups(lista);
      if (err) throw new Error(err);
      return lista;
    },
    onSuccess: (lista) => {
      queryClient.setQueryData(['admin-popups'], lista.map(normalizarPopup));
      queryClient.invalidateQueries({ queryKey: ['popups-config'] });
    },
  });

  const ids = useMemo(() => popups.map((p) => p.id), [popups]);

  const guardarPopup = (popup) => {
    const existe = popups.some((p) => p.id === popup.id);
    const lista = existe ? popups.map((p) => (p.id === popup.id ? popup : p)) : [...popups, popup];
    guardar.mutate(lista, { onSuccess: () => setEditando(null) });
  };

  const alternar = (popup) => {
    guardar.mutate(popups.map((p) => (p.id === popup.id ? { ...p, activo: !p.activo } : p)));
  };

  const eliminar = (popup) => {
    if (!window.confirm(`¿Eliminar el popup "${popup.nombre || popup.titulo}"? Sus métricas se conservan.`)) return;
    guardar.mutate(popups.filter((p) => p.id !== popup.id));
  };

  const reiniciar = () => {
    reiniciarEstadoLocal();
    setAviso('Listo: en este navegador los popups volverán a aparecer como si fuera la primera visita.');
  };

  const ordenados = [...popups].sort((a, b) => Number(b.activo) - Number(a.activo) || b.prioridad - a.prioridad);

  return (
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <h1 className={styles.titulo}>Popups y anuncios</h1>
          <p className={styles.subtitulo}>
            Ventanas que aparecen en la tienda para invitar a llenar la encuesta, anunciar un Live, una promo o los referidos.
            Cada persona ve como mucho uno por visita.
          </p>
        </div>
        <div className={styles.acciones}>
          <button type="button" className={styles.btnSecundario} onClick={reiniciar} title="Para probar en este navegador">
            <RotateCcw size={16} /> Volver a verlos aquí
          </button>
          <button
            type="button"
            className={styles.btnPrimario}
            onClick={() => setEditando({ ...POPUP_VACIO, activo: true })}
            disabled={isLoading || !!error}
          >
            <Plus size={16} /> Nuevo popup
          </button>
        </div>
      </header>

      {aviso && <p className={styles.aviso}>{aviso}</p>}
      {guardar.error && <p className={styles.error}>No se pudo guardar: {guardar.error.message}</p>}
      {error && <p className={styles.error}>No se pudieron cargar los popups: {error.message}</p>}
      {isLoading && <p className={styles.nota}>Cargando…</p>}

      {editando && (
        <Editor
          key={editando.id || 'nuevo'}
          inicial={normalizarPopup(editando)}
          idsExistentes={ids}
          guardando={guardar.isPending}
          onGuardar={guardarPopup}
          onCancelar={() => setEditando(null)}
        />
      )}

      {!isLoading && !error && ordenados.length === 0 && (
        <p className={styles.nota}>No hay popups. Crea uno con “Nuevo popup”.</p>
      )}

      <div className={styles.lista}>
        {ordenados.map((p) => (
          <article key={p.id} className={`${styles.card} ${p.activo ? '' : styles.apagado}`}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitulo}>
                <h3>{p.nombre || p.titulo}</h3>
                <span className={p.activo ? styles.badgeOn : styles.badgeOff}>{p.activo ? 'Activo' : 'Apagado'}</span>
                <span className={styles.badge}>{etiqueta('objetivo', p.objetivo)}</span>
                <span className={styles.badge}>{p.formato === 'imagen' ? 'Imagen' : 'Tarjeta'}</span>
              </div>
              <label className={styles.switch} title={p.activo ? 'Apagar' : 'Encender'}>
                <input type="checkbox" checked={p.activo} onChange={() => alternar(p)} disabled={guardar.isPending} />
                <span className={styles.srOnly}>Activo</span>
              </label>
            </div>
            <div className={styles.cardCuerpo}>
              {p.imagenUrl && <img className={styles.miniatura} src={p.imagenUrl} alt="" />}
              <p className={styles.resumen}>
                <strong>{p.titulo}</strong>
                {p.formato !== 'imagen' && p.texto && <> — {p.texto}</>}
              </p>
            </div>
            <p className={styles.meta}>
              {etiqueta('audiencia', p.audiencia)} · {etiqueta('paginas', p.paginas)} · {etiqueta('dispositivo', p.dispositivo)} ·
              {' '}aparece {describirCuando(p)} · no se repite por {p.cooldownDias} días
              {(p.desde || p.hasta) && <> · {p.desde || '…'} → {p.hasta || '…'}</>}
            </p>
            <Estadisticas popupId={p.id} />
            <div className={styles.cardAcciones}>
              <button type="button" className={styles.btnSecundario} onClick={() => setPrevia(p)}><Eye size={15} /> Ver</button>
              <button type="button" className={styles.btnSecundario} onClick={() => setEditando(p)}><Pencil size={15} /> Editar</button>
              <button type="button" className={`${styles.btnSecundario} ${styles.peligro}`} onClick={() => eliminar(p)} disabled={guardar.isPending}>
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className={styles.nota}>
        Clics = personas que tocaron el botón (y % sobre las vistas). Conversiones = quienes además cumplieron el objetivo
        (p. ej. terminaron la encuesta) en los 7 días siguientes, y % sobre los clics.
      </p>

      {previa && <PopupCard popup={previa} onCta={() => setPrevia(null)} onClose={() => setPrevia(null)} />}
    </div>
  );
};

export default AdminPopups;
