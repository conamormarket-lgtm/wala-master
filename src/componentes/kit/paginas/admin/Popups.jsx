import React, { useState } from 'react';
import { Eye, Power, RotateCcw } from 'lucide-react';
import Boton from '../../Boton';
import { useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { CampoFecha } from '../../Fecha';
import { Chip } from '../../Etiquetas';
import { VentanaCampana } from '../../piezas/Marco';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, ElegirUno, CampoLista } from '../../piezas/admin/Formularios';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda } from './celdas';
import { campanaDesdePopup } from '../../adaptadores';
import { OPCIONES, POPUP_VACIO, PAGINAS_SUGERIDAS, idDesdeNombre, normalizarPopup, normalizarRuta } from '../../../../services/popupsLogic.mjs';
import { cuandoPopup, erroresDePopup, tasaTexto } from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Popups.module.css';

/*
 * D6d · Popups (/admin/popups): las ventanas de campaña de la tienda
 * (encuesta, una promo, un Live, los referidos). Se guarda la lista entera en
 * storeConfig/popups, tal cual la lee la tienda; la vista previa es la misma
 * VentanaCampana que ve el cliente.
 */

const opciones = (campo) => OPCIONES[campo].map((o) => ({ valor: o.value, texto: o.label }));
const etiqueta = (campo, v) => OPCIONES[campo].find((o) => o.value === v)?.label || v;
const nombrePagina = (ruta) => PAGINAS_SUGERIDAS.find((x) => x.ruta === ruta)?.label || ruta;
const ESTADOS = { si: { texto: 'Activo', tono: 'exito' }, no: { texto: 'Apagado', tono: 'neutro' } };
const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const errorDe = (err) => err?.message || 'Vuelve a intentar.';

function dondeTexto(p) {
  const paginas = p.paginas === 'elegidas' ? (p.rutas.length ? p.rutas.map(nombrePagina).join(', ') : 'Sin páginas elegidas') : etiqueta('paginas', p.paginas);
  return `${etiqueta('audiencia', p.audiencia)} · ${paginas} · ${etiqueta('dispositivo', p.dispositivo)}`;
}

/** "En qué páginas": las de siempre como chips y otras a mano (con /* para todo lo de adentro). */
function ElegirPaginas({ rutas = [], onCambiar, error, id }) {
  const sugeridas = PAGINAS_SUGERIDAS.map((x) => x.ruta);
  const propias = rutas.filter((r) => !sugeridas.includes(r));
  return (
    <div className={s.paginas} id={id} tabIndex={-1}>
      <span className={s.chips} role="group" aria-label="Páginas de la tienda">
        {PAGINAS_SUGERIDAS.map((x) => (
          <Chip key={x.ruta} tamano="sm" activo={rutas.includes(x.ruta)} onClick={() => onCambiar(rutas.includes(x.ruta) ? rutas.filter((r) => r !== x.ruta) : [...rutas, x.ruta])}>{x.label}</Chip>
        ))}
      </span>
      <CampoLista
        etiqueta="Otras páginas"
        ayuda="Pega el link o escribe /alianza-lima. Termina en /* para incluir todo lo de adentro (/producto/* = cualquier producto)."
        valores={propias}
        onCambiar={(v) => onCambiar([...rutas.filter((r) => sugeridas.includes(r)), ...v.map(normalizarRuta).filter(Boolean)])}
        textoCampo="Agregar una página"
        placeholder="/alianza-lima"
      />
      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}

/**
 * Popups (/admin/popups).
 *  - popups: [normalizarPopup] (popupsDesdeDoc) · cargando · error · onReintentar
 *  - onGuardarPopups(lista) → promesa (la lista entera, como se guarda) · subirImagen(blob, { alAvanzar }) → url
 *  - estadisticas: { [id]: { vistas, clics, cierres, conversiones } } · onReiniciarLocal (volver a verlos en este navegador)
 */
export function PaginaPopupsAdmin({ popups = [], cargando, error, onReintentar, onGuardarPopups, subirImagen, estadisticas = {}, onReiniciarLocal }) {
  const toast = useToast();
  const [previa, setPrevia] = useState(null);
  const guardarLista = (lista) => onGuardarPopups?.(lista.map(normalizarPopup));
  const alternar = async (p) => {
    try {
      await guardarLista(popups.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)));
      toast({ tipo: 'exito', titulo: p.activo ? 'Popup apagado' : 'Popup encendido', texto: p.nombre || p.titulo });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    }
  };
  const registros = [...popups].sort((a, b) => Number(b.activo) - Number(a.activo) || b.prioridad - a.prioridad);

  return (
    <>
      <PaginaListaAdmin
        cabeza={{
          icono: 'popups',
          tono: 'rosa',
          titulo: 'Popups y anuncios',
          subtitulo: 'Ventanas en la tienda para la encuesta, un Live, una promo o los referidos. Cada persona ve como mucho uno por visita.',
          acciones: onReiniciarLocal ? <Boton tamano="sm" variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={() => { onReiniciarLocal(); toast({ tipo: 'exito', titulo: 'Listo', texto: 'En este navegador los popups vuelven a salir como en la primera visita.' }); }}>Volver a verlos aquí</Boton> : undefined,
        }}
        antes={<p className={s.nota}>Nunca aparecen en el carrito, el pago, el login, el admin, la encuesta ni el editor. Clics: quienes tocaron el botón (y su parte de las vistas). Conversiones: quienes además cumplieron el objetivo en los 7 días siguientes (y su parte de los clics).</p>}
        registros={registros}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        nombreDe={(p) => p.nombre || p.titulo}
        unidad={['popup', 'popups']}
        filtros={[
          { id: 'estado', etiqueta: 'Estado', todos: 'Activos y apagados', opciones: [{ valor: 'si', texto: 'Activos' }, { valor: 'no', texto: 'Apagados' }], filtrar: (p, v) => (v === 'si' ? p.activo : !p.activo) },
          { id: 'objetivo', etiqueta: 'Para', todos: 'Todo', opciones: opciones('objetivo'), filtrar: (p, v) => p.objetivo === v },
        ]}
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagenUrl} /> },
          { id: 'nombre', titulo: 'Popup', tarjeta: 'titulo', celda: (p) => <>{p.nombre || p.titulo}<span className={l.sub}>{etiqueta('objetivo', p.objetivo)} · {p.formato === 'imagen' ? 'solo imagen' : 'tarjeta'}</span></> },
          { id: 'donde', titulo: 'A quién y dónde', tarjeta: 'detalle', celda: (p) => <>{dondeTexto(p)}<span className={l.sub}>Aparece {cuandoPopup(p)} · no se repite por {p.cooldownDias} días{p.desde || p.hasta ? ` · ${p.desde || '…'} → ${p.hasta || '…'}` : ''}</span></> },
          { id: 'resultados', titulo: 'Vistas · clics', ancho: 150, alinear: 'fin', tarjeta: 'detalle', celda: (p) => {
            const e = estadisticas[p.id];
            return e ? <span className={l.numero}>{entero(e.vistas)} · {entero(e.clics)}<span className={l.sub}>{tasaTexto(e.clics, e.vistas)} tocan · {entero(e.conversiones)} cumplen ({tasaTexto(e.conversiones, e.clics)})</span></span> : <span className={l.sub}>—</span>;
          } },
          { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={p.activo ? 'si' : 'no'} estados={ESTADOS} /> },
        ]}
        vacio={{ titulo: 'Todavía no hay popups', texto: 'Crea el primero para invitar a llenar la encuesta o anunciar una promo.' }}
        textos={{ creado: 'Popup creado', guardado: 'Popup guardado', eliminado: 'Popup eliminado' }}
        eliminar={{ texto: (p) => `Se borra «${p.nombre || p.titulo}». Sus métricas se conservan.` }}
        masAcciones={(p) => [
          { id: 'ver', etiqueta: 'Ver cómo se ve', Icono: Eye, accion: () => setPrevia(p) },
          { id: 'activo', etiqueta: p.activo ? 'Apagar' : 'Encender', Icono: Power, accion: () => alternar(p) },
        ]}
        onEliminar={(id) => guardarLista(popups.filter((x) => x.id !== id))}
        onGuardar={(d, id) => {
          const p = normalizarPopup({ ...d, id: id || idDesdeNombre(d.nombre || d.titulo, popups.map((x) => x.id)) });
          return guardarLista(id ? popups.map((x) => (x.id === id ? p : x)) : [...popups, p]);
        }}
        formulario={{
          nuevo: 'Nuevo popup',
          titulos: { nuevo: 'Nuevo popup', editar: 'Editar popup' },
          textoGuardar: { nuevo: 'Crear popup' },
          vacio: () => ({ ...POPUP_VACIO, activo: true }),
          desde: (p) => ({ ...normalizarPopup(p), id: undefined }),
          validar: (d) => erroresDePopup(d),
          campos: ({ datos: d, cambiar, errores, idDe }) => {
            const imagen = d.formato === 'imagen';
            return (
              <>
                <GrupoCampos titulo="Qué dice">
                  <Campo etiqueta="Nombre para ti" ayuda="Solo lo ves tú, para reconocerlo en la lista." placeholder="Ej. Encuesta de octubre" value={d.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
                  <ElegirUno etiqueta="Formato" opciones={[{ valor: 'tarjeta', texto: 'Tarjeta con texto y botón' }, { valor: 'imagen', texto: 'Solo imagen' }]} valor={d.formato} onElegir={(v) => v && cambiar('formato', v)} />
                  <p className={s.nota}>{imagen ? 'Se ve solo la imagen; tocarla hace lo del botón. Pon todo el mensaje dentro de la imagen.' : 'Título, texto y un botón; la imagen es opcional y va arriba.'}</p>
                  <Campo id={idDe('titulo')} etiqueta={imagen ? 'Qué dice la imagen' : 'Título'} ayuda={imagen ? 'No se ve: lo leen los lectores de pantalla.' : undefined} maxLength={120} value={d.titulo} error={errores.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />
                  {!imagen && <Campo etiqueta="Texto" multilinea={3} maxLength={400} value={d.texto} onChange={(e) => cambiar('texto', e.target.value)} />}
                  <span id={idDe('imagenUrl')} tabIndex={-1} />
                  <CampoImagen etiqueta={imagen ? 'Imagen' : 'Imagen (opcional)'} ayuda={imagen ? 'Cuadrada o vertical se ve bien en el celular.' : 'Horizontal, 16:9.'} error={errores.imagenUrl} valor={d.imagenUrl} onCambiar={(url) => cambiar('imagenUrl', url)} subir={subirImagen} conEnlace forma={imagen ? 'cuadro' : 'ancho'} />
                </GrupoCampos>
                <GrupoCampos titulo={imagen ? 'Al tocar la imagen' : 'El botón'}>
                  <Campo etiqueta={imagen ? 'Lleva a' : 'Qué hace'} opciones={opciones('objetivo')} value={d.objetivo} onChange={(e) => cambiar('objetivo', e.target.value)} />
                  <p className={s.nota}>{d.objetivo === 'encuesta' ? 'A la encuesta (o a iniciar sesión). No sale a quien ya la llenó; llenarla cuenta como conversión.' : d.objetivo === 'registro' ? 'A crear una cuenta. Nunca sale a quien ya inició sesión; crear la cuenta cuenta como conversión.' : 'Al enlace que pongas: una página de la tienda (/tienda) o uno de afuera.'}</p>
                  <div className={s.dos}>
                    {!imagen && <Campo id={idDe('botonTexto')} etiqueta="Texto del botón" maxLength={40} value={d.botonTexto} error={errores.botonTexto} onChange={(e) => cambiar('botonTexto', e.target.value)} />}
                    {d.objetivo === 'enlace' && <Campo id={idDe('botonUrl')} etiqueta="Enlace" placeholder="/tienda" value={d.botonUrl} error={errores.botonUrl} onChange={(e) => cambiar('botonUrl', e.target.value)} />}
                  </div>
                  {!imagen && <Campo etiqueta="Texto para cerrar" ayuda="Vacío: solo la ×." maxLength={40} value={d.cerrarTexto} onChange={(e) => cambiar('cerrarTexto', e.target.value)} />}
                </GrupoCampos>
                <GrupoCampos titulo="A quién y dónde">
                  <div className={s.dos}>
                    <Campo etiqueta="A quién" opciones={opciones('audiencia')} value={d.audiencia} onChange={(e) => cambiar('audiencia', e.target.value)} />
                    <Campo etiqueta="En qué aparato" opciones={opciones('dispositivo')} value={d.dispositivo} onChange={(e) => cambiar('dispositivo', e.target.value)} />
                  </div>
                  <Campo etiqueta="En qué páginas" opciones={opciones('paginas')} value={d.paginas} onChange={(e) => cambiar('paginas', e.target.value)} />
                  {d.paginas === 'elegidas' && <ElegirPaginas id={idDe('rutas')} rutas={d.rutas || []} error={errores.rutas} onCambiar={(v) => cambiar('rutas', v)} />}
                </GrupoCampos>
                <GrupoCampos titulo="Cuándo">
                  <Campo etiqueta="Aparece" opciones={opciones('disparador')} value={d.disparador} onChange={(e) => cambiar('disparador', e.target.value)} />
                  <div className={s.dos}>
                    {d.disparador === 'scroll'
                      ? <Campo etiqueta="Cuánto de la página" type="number" inputMode="numeric" min={5} max={100} sufijo="%" value={d.scrollPct} onChange={(e) => cambiar('scrollPct', e.target.value)} />
                      : <Campo etiqueta="Segundos en la tienda" ayuda={d.disparador === 'salida' ? 'En el celular se usa esto.' : '0: apenas entra.'} type="number" inputMode="numeric" min={0} max={600} sufijo="s" value={d.segundos} onChange={(e) => cambiar('segundos', e.target.value)} />}
                    <Campo etiqueta="No repetir por" ayuda="Después de verlo, esa persona no lo vuelve a ver." type="number" inputMode="numeric" min={0} max={365} sufijo="días" value={d.cooldownDias} onChange={(e) => cambiar('cooldownDias', e.target.value)} />
                  </div>
                  <div className={s.dos}>
                    <CampoFecha etiqueta="Desde (opcional)" valor={d.desde} max={d.hasta || undefined} onCambiar={(v) => cambiar('desde', v)} />
                    <CampoFecha id={idDe('hasta')} etiqueta="Hasta (opcional)" valor={d.hasta} min={d.desde || undefined} error={errores.hasta} onCambiar={(v) => cambiar('hasta', v)} />
                  </div>
                  <Campo etiqueta="Prioridad" ayuda="Si aplican varios, sale el de número más alto." type="number" inputMode="numeric" value={d.prioridad} onChange={(e) => cambiar('prioridad', e.target.value)} />
                  <Interruptor etiqueta="Activo" descripcion="Apagado no sale (no se borra)." activo={d.activo} onChange={(v) => cambiar('activo', v)} />
                </GrupoCampos>
                <Boton variante="secundario" icono={<Eye aria-hidden="true" />} disabled={Object.values(erroresDePopup(d)).some(Boolean)} onClick={() => setPrevia(normalizarPopup(d))}>Ver cómo se ve</Boton>
              </>
            );
          },
        }}
      />
      {previa && <VentanaCampana abierta onCerrar={() => setPrevia(null)} onAccion={() => setPrevia(null)} {...campanaDesdePopup(previa)} />}
    </>
  );
}
