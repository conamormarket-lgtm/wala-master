import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar } from '../../Feedback';
import { Sello } from '../../Marca';
import s from './Pasos.module.css';

/*
 * Un paso de una herramienta de una sola vez (crear los productos de Yoryo,
 * crear cuentas desde pedidos, reconstruir un resumen…): su número en un
 * sello, qué hace, su botón y lo que va pasando mientras corre.
 */

/**
 * Un paso.
 *  - numero · titulo · children (qué hace)
 *  - boton: { texto, variante } · onEjecutar(avisar) → promesa; avisar(texto)
 *    muestra cómo va; lo que devuelve queda como resultado: un texto, o
 *    { texto, aviso: true } si terminó a medias (en ámbar, el sello no se pone verde)
 *  - confirmar: { titulo, texto, confirmar } (pregunta antes) · deshabilitado · motivo (por qué no se puede)
 *  - contenido: lo que se elige antes de correrlo (va entre el texto y el botón)
 */
export function PasoAdmin({ numero, titulo, children, boton = {}, onEjecutar, confirmar, deshabilitado = false, motivo, contenido }) {
  const [corriendo, setCorriendo] = useState(false);
  const [avance, setAvance] = useState('');
  const [resultado, setResultado] = useState(null); // { ok, aviso, texto }
  const [preguntando, setPreguntando] = useState(false);

  const correr = async () => {
    setPreguntando(false);
    setCorriendo(true);
    setResultado(null);
    setAvance('');
    try {
      const r = await onEjecutar?.((t) => setAvance(String(t || '')));
      const texto = typeof r === 'string' ? r : r?.texto;
      setResultado({ ok: true, aviso: Boolean(r?.aviso), texto: texto || 'Listo.' });
    } catch (err) {
      setResultado({ ok: false, texto: err?.message || 'No se pudo. Vuelve a intentar.' });
    } finally {
      setCorriendo(false);
      setAvance('');
    }
  };

  return (
    <section className={s.paso} data-componente="PasoAdmin" aria-busy={corriendo || undefined}>
      <Sello tamano={40} tono={resultado?.ok && !resultado.aviso ? 'menta' : 'degradado'}>
        {resultado?.ok && !resultado.aviso ? <CheckCircle2 /> : <span className={s.numero}>{numero}</span>}
      </Sello>
      <div className={s.cuerpo}>
        <h2 className={s.titulo}>{titulo}</h2>
        {children && <div className={s.texto}>{children}</div>}
        {contenido && <div className={s.contenido}>{contenido}</div>}
        <div className={s.pie}>
          {onEjecutar && (
            <Boton variante={boton.variante || 'secundario'} cargando={corriendo} disabled={deshabilitado} onClick={() => (confirmar ? setPreguntando(true) : correr())}>
              {boton.texto || 'Hacerlo'}
            </Boton>
          )}
          {deshabilitado && motivo && !corriendo && <span className={s.motivo}>{motivo}</span>}
          <span className={s.estado} aria-live="polite">
            {corriendo && <><Loader2 className={s.girar} aria-hidden="true" /> {avance || 'Trabajando…'}</>}
            {!corriendo && resultado && (
              <span className={!resultado.ok ? s.error : resultado.aviso ? s.aviso : s.ok}>
                {!resultado.ok ? <AlertCircle aria-hidden="true" /> : resultado.aviso ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {resultado.texto}
              </span>
            )}
          </span>
        </div>
      </div>
      {confirmar && (
        <Confirmar
          abierta={preguntando}
          titulo={confirmar.titulo}
          texto={confirmar.texto}
          confirmar={confirmar.confirmar || 'Sí, hacerlo'}
          onConfirmar={correr}
          onCancelar={() => setPreguntando(false)}
        />
      )}
    </section>
  );
}
