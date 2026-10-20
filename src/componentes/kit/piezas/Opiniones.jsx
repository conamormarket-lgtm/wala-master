import React, { useEffect, useId, useRef, useState } from 'react';
import { Star, ThumbsUp, ImagePlus, X, Award, LogIn, Send } from 'lucide-react';
import Boton from '../Boton';
import { Campo } from '../Formulario';
import { Sello } from '../Marca';
import { Avatar } from './Avatar';
import { Traducido } from './TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './Opiniones.module.css';

/*
 * Las opiniones de un producto: el resumen (promedio, total y una barra por
 * estrella), cada opinión con sus fotos y "Útil", y el formulario para dejar
 * una. Van debajo de la ficha del producto.
 */

/**
 * Estrellas: para mostrar una nota (valor 0–5, con medias) o, con onCambiar,
 * para elegirla (un grupo de radios: flechas y Enter).
 *  - valor · tamano (px) · onCambiar(n) · etiqueta (para el lector de pantalla)
 */
/** "1 estrella" … "5 estrellas", traducidas (para los aria-label). */
function useNombresEstrellas() {
  return [useTexto('1 estrella'), useTexto('2 estrellas'), useTexto('3 estrellas'), useTexto('4 estrellas'), useTexto('5 estrellas')];
}

export function Estrellas({ valor = 0, tamano = 16, onCambiar, etiqueta = 'Calificación' }) {
  const [encima, setEncima] = useState(0);
  const nombre = useId();
  const nota = useTexto(`${Number(valor).toFixed(1).replace('.0', '')} de 5 estrellas`);
  const grupo = useTexto(etiqueta);
  const estrellas = useNombresEstrellas();
  if (!onCambiar) {
    return (
      <span className={s.estrellas} style={{ '--tam': `${tamano}px` }} role="img" aria-label={nota}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={s.estrella} style={{ '--lleno': `${Math.max(0, Math.min(1, valor - n + 1)) * 100}%` }}>
            <Star aria-hidden="true" />
            <Star aria-hidden="true" className={s.llena} />
          </span>
        ))}
      </span>
    );
  }
  const visible = encima || valor;
  return (
    <span className={[s.estrellas, s.elegir].join(' ')} style={{ '--tam': `${tamano}px` }} role="radiogroup" aria-label={grupo} onMouseLeave={() => setEncima(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={s.estrella} style={{ '--lleno': n <= visible ? '100%' : '0%' }} onMouseEnter={() => setEncima(n)}>
          <input type="radio" name={nombre} value={n} checked={valor === n} onChange={() => onCambiar(n)} aria-label={estrellas[n - 1]} />
          <Star aria-hidden="true" />
          <Star aria-hidden="true" className={s.llena} />
        </label>
      ))}
    </span>
  );
}

/**
 * El resumen: el promedio grande, las estrellas, cuántas opiniones y una
 * barra por estrella (toca una para ver solo esas).
 *  - promedio · total · porEstrella: { 5: n, 4: n… } · filtro · onFiltro(n | null)
 *  - accion: el botón "Escribir una opinión"
 */
export function ResumenOpiniones({ promedio = 0, total = 0, porEstrella = {}, filtro, onFiltro, accion }) {
  const estrellas = useNombresEstrellas();
  return (
    <div className={s.resumen} data-componente="ResumenOpiniones">
      <div className={s.nota}>
        <strong>{total ? promedio.toFixed(1) : '–'}</strong>
        <span>
          <Estrellas valor={promedio} tamano={18} />
          <small><Texto>{total === 1 ? '1 opinión' : `${total} opiniones`}</Texto></small>
        </span>
      </div>
      <ul className={s.barras}>
        {[5, 4, 3, 2, 1].map((n) => {
          const cuantas = porEstrella[n] || 0;
          const activa = filtro === n;
          return (
            <li key={n}>
              <button
                type="button"
                className={[s.barra, activa && s.barraActiva].filter(Boolean).join(' ')}
                onClick={() => onFiltro?.(activa ? null : n)}
                disabled={!cuantas}
                aria-pressed={activa}
                aria-label={`${estrellas[n - 1]}: ${cuantas}`}
              >
                <span className={s.barraNumero}>{n} <Star aria-hidden="true" /></span>
                <span className={s.pista}><span style={{ transform: `scaleX(${total ? cuantas / total : 0})` }} /></span>
                <span className={s.barraCuenta}>{cuantas}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {accion}
    </div>
  );
}

/**
 * Una opinión: quién (avatar con iniciales), cuándo, las estrellas, el texto,
 * sus fotos (se abren al tocarlas) y "Útil".
 *  - autor · fecha · puntuacion · texto · fotos: [url] · utiles (cuántos)
 *  - marcada: ya la marcaste útil · onUtil() · onFoto(url) · destacada
 */
export function TarjetaOpinion({ autor, fecha, puntuacion = 5, texto, fotos = [], utiles = 0, marcada = false, onUtil, onFoto, destacada = false }) {
  return (
    <article className={[s.opinion, destacada && s.destacada].filter(Boolean).join(' ')} data-componente="TarjetaOpinion">
      {destacada && (
        <p className={s.destacadaEtiqueta}><Sello tamano={22} girar={-8}><Award aria-hidden="true" /></Sello> <Texto>La más útil para la comunidad</Texto></p>
      )}
      <header className={s.opinionCabeza}>
        <Avatar className={s.avatar} nombre={autor} letras={1} />
        <span className={s.quien}>
          <strong>{autor}</strong>
          {fecha && <small>{fecha}</small>}
        </span>
        <Estrellas valor={puntuacion} tamano={14} />
      </header>
      {texto && <p className={s.texto}>{texto}</p>}
      {fotos.length > 0 && (
        <div className={s.fotos}>
          {fotos.map((f, i) => (
            <Traducido key={f} texto={`Ver la foto ${i + 1}`}>{(etiqueta) => (
              <button type="button" className={s.foto} onClick={() => onFoto?.(f)} aria-label={etiqueta}>
                <img {...atributosDeFoto(f, '120px')} alt="" loading="lazy" />
              </button>
            )}</Traducido>
          ))}
        </div>
      )}
      <footer className={s.opinionPie}>
        <button type="button" className={[s.util, marcada && s.utilMarcada].filter(Boolean).join(' ')} onClick={onUtil} aria-pressed={marcada}>
          <ThumbsUp aria-hidden="true" /> <Texto>Útil</Texto>{utiles > 0 && <span> · {utiles}</span>}
        </button>
      </footer>
    </article>
  );
}

/**
 * Dejar una opinión: las estrellas, el texto y hasta 5 fotos. Sin sesión,
 * la invitación a entrar.
 *  - onEnviar({ puntuacion, texto, fotos: [File] }): promesa · sesion · urlLogin
 *  - onCancelar · maxFotos (5)
 */
export function FormularioOpinion({ onEnviar, onCancelar, sesion = true, urlLogin = '/login', maxFotos = 5 }) {
  const [puntuacion, setPuntuacion] = useState(0);
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Las vistas previas se sueltan al quitar la foto o al salir (las de ese
  // momento, no las del principio).
  const vivas = useRef(fotos);
  vivas.current = fotos;
  useEffect(() => () => vivas.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  if (!sesion) {
    return (
      <div className={s.entrar} data-componente="FormularioOpinion">
        <p><Texto>Inicia sesión para contar qué te pareció.</Texto></p>
        <Boton to={urlLogin} tamano="sm" icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
      </div>
    );
  }

  const elegir = (e) => {
    const nuevas = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (fotos.length + nuevas.length > maxFotos) setError(`Puedes subir hasta ${maxFotos} fotos.`);
    setFotos((x) => [...x, ...nuevas.slice(0, maxFotos - x.length).map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }))]);
  };
  const quitar = (i) => setFotos((x) => {
    URL.revokeObjectURL(x[i].url);
    return x.filter((_, k) => k !== i);
  });
  const enviar = async (e) => {
    e.preventDefault();
    if (!puntuacion) { setError('Elige de 1 a 5 estrellas.'); return; }
    if (!texto.trim()) { setError('Cuéntanos qué te pareció.'); return; }
    setError(null);
    setEnviando(true);
    try {
      await onEnviar?.({ puntuacion, texto: texto.trim(), fotos: fotos.map((f) => f.archivo) });
    } catch (err) {
      // Lo que no se pudo publicar se queda en el formulario, con el motivo.
      setError(err?.message || 'No pudimos publicar tu opinión. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className={s.formulario} onSubmit={enviar} data-componente="FormularioOpinion">
      <div className={s.grupo}>
        <span className={s.rotulo}><Texto>Tu calificación</Texto></span>
        <Estrellas valor={puntuacion} tamano={30} onCambiar={(n) => { setPuntuacion(n); setError(null); }} etiqueta="Tu calificación" />
      </div>
      <Campo
        etiqueta="Tu opinión"
        multilinea
        maxLength={800}
        placeholder="¿Qué te pareció? ¿La talla, el color, la calidad?"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setError(null); }}
      />
      <div className={s.grupo}>
        <span className={s.rotulo}><Texto>Fotos</Texto> <small><Texto>{`(opcional, hasta ${maxFotos})`}</Texto></small></span>
        <div className={s.fotos}>
          {fotos.map((f, i) => (
            <span key={f.url} className={s.foto}>
              <img src={f.url} alt="" />
              <Traducido texto={`Quitar la foto ${i + 1}`}>{(etiqueta) => <button type="button" className={s.quitarFoto} onClick={() => quitar(i)} aria-label={etiqueta}><X aria-hidden="true" /></button>}</Traducido>
            </span>
          ))}
          {fotos.length < maxFotos && (
            <label className={s.agregarFoto}>
              <input type="file" accept="image/*" multiple onChange={elegir} />
              <ImagePlus aria-hidden="true" />
              <span><Texto>Agregar</Texto></span>
            </label>
          )}
        </div>
      </div>
      {error && <p className={s.error} role="alert"><Texto>{error}</Texto></p>}
      <div className={s.botones}>
        {onCancelar && <Boton variante="fantasma" onClick={onCancelar} disabled={enviando}><Texto>Cancelar</Texto></Boton>}
        <Boton type="submit" icono={<Send aria-hidden="true" />} cargando={enviando}><Texto>Publicar opinión</Texto></Boton>
      </div>
    </form>
  );
}
