import React, { useState } from 'react';
import { Send } from 'lucide-react';
import Boton from '../Boton';
import { Campo } from '../Formulario';
import { Aviso } from '../Feedback';
import { IconoWala } from '../IconosWala';
import { BarraProgreso } from './BarraProgreso';
import s from './RetoSemanal.module.css';

/**
 * El reto de la semana (globals/activeChallenge): qué hay que hacer, el premio,
 * cuánto llevas y, en los retos manuales, el enlace con la evidencia. Va en la
 * ventana de Kapi; también sirve en la cuenta.
 *
 *  - titulo, descripcion
 *  - recompensa: texto ("10 monedas", "Doble monedas al alimentar")
 *  - progreso, meta
 *  - completado: muestra "¡Reto completado!" en vez del progreso
 *  - conEvidencia: reto manual (actionType 'manual_…'): pide un enlace
 *  - onEnviar(url) → promesa; si falla, el error se muestra aquí mismo (antes
 *    eran alert() del navegador)
 */
export function RetoSemanal({ titulo, descripcion, recompensa, progreso = 0, meta = 1, completado = false, conEvidencia = false, onEnviar }) {
  const [url, setUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    if (!url.trim() || enviando) return;
    setEnviando(true);
    setResultado(null);
    try {
      await onEnviar?.(url.trim());
      setResultado({ tipo: 'exito', texto: '¡Evidencia enviada! La revisamos pronto.' });
      setUrl('');
    } catch (err) {
      setResultado({ tipo: 'error', texto: `No se pudo enviar: ${err?.message || 'inténtalo de nuevo.'}` });
    }
    setEnviando(false);
  };

  return (
    <section className={s.reto} aria-label="Reto semanal">
      <div className={s.cabeza}>
        <IconoWala nombre="estrella" tamano={40} />
        <div className={s.textos}>
          <p className={s.antetitulo}>Reto semanal</p>
          <h3 className={s.titulo}>{titulo}</h3>
          {recompensa && <p className={s.premio}>Premio: <strong>{recompensa}</strong></p>}
        </div>
      </div>
      {descripcion && <p className={s.descripcion}>{descripcion}</p>}

      {completado ? (
        <Aviso compacto tipo="exito">¡Reto completado! Ya te dimos el premio.</Aviso>
      ) : (
        <>
          <BarraProgreso valor={Math.min(progreso, meta)} max={meta} minimo={0} etiqueta="Tu avance" />
          {conEvidencia && (
            <form className={s.evidencia} onSubmit={enviar}>
              <Campo
                type="url"
                inputMode="url"
                placeholder="Pega el enlace de tu foto o historia"
                aria-label="Enlace de tu evidencia"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Boton type="submit" variante="secundario" cargando={enviando} disabled={!url.trim()} icono={<Send aria-hidden="true" />}>
                Enviar
              </Boton>
            </form>
          )}
          {resultado && <Aviso compacto tipo={resultado.tipo}>{resultado.texto}</Aviso>}
        </>
      )}
    </section>
  );
}
