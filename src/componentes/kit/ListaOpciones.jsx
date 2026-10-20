import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { PanelFlotante } from './PanelFlotante';
import { Texto, useTexto } from './Traduccion';
import s from './ListaOpciones.module.css';

const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Lista desplegable de Walá (en vez del <select> del navegador, que en cada
 * teléfono se ve distinto). En escritorio abre un panel pegado al campo; en el
 * celular, una hoja inferior. Con teclado: flechas, Enter, Esc y escribir para
 * saltar a una opción.
 *  - opciones: [{ valor, texto, detalle, icono, deshabilitada }]. Una opción
 *    con valor '' y deshabilitada es el texto de "nada elegido" ("Elige…").
 *  - value · onChange(evento): igual que un <select> (`e.target.value`)
 *  - buscable: con buscador arriba (por defecto, con más de 10 opciones)
 *  - creable: si lo escrito no está en la lista, "Usar «…»" (gustos con
 *    sugerencias)
 *  - placeholder · disabled · etiqueta: título de la hoja en el celular
 *  - id, aria-*: los pone Campo para la etiqueta, la ayuda y el error
 *  - compacto: solo el texto corto (`corto` de cada opción), p. ej. "+51"
 */
export default function ListaOpciones({
  opciones = [], value, onChange, buscable, creable = false, placeholder = 'Elige…', disabled = false,
  etiqueta, id, compacto = false, className, ...aria
}) {
  const autoId = useId();
  const listaId = `${id || autoId}-lista`;
  const disparador = useRef(null);
  const buscador = useRef(null);
  const lista = useRef(null);
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [activa, setActiva] = useState(0);
  const tecleo = useRef({ texto: '', reloj: 0 });

  const vacia = opciones.find((o) => o.valor === '' && o.deshabilitada);
  const elegibles = useMemo(() => opciones.filter((o) => !(o.valor === '' && o.deshabilitada)), [opciones]);
  const conBuscador = buscable ?? (elegibles.length > 10 || creable);
  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    const lista2 = q ? elegibles.filter((o) => sinTildes(`${o.texto} ${o.detalle || ''}`).includes(q)) : elegibles;
    const exacta = elegibles.some((o) => sinTildes(o.texto) === q);
    return creable && q && !exacta ? [...lista2, { valor: busqueda.trim(), texto: `Usar «${busqueda.trim()}»`, nueva: true }] : lista2;
  }, [elegibles, busqueda, creable]);
  const elegida = elegibles.find((o) => o.valor === value);
  const textoElegido = elegida ? (compacto && elegida.corto ? elegida.corto : elegida.texto) : (value || '');
  // Los textos propios se traducen; las opciones (países, regiones, nombres) van tal cual.
  const t = {
    vacio: useTexto(vacia?.texto || placeholder),
    etiqueta: useTexto(etiqueta),
    buscar: useTexto(conBuscador ? (creable ? 'Busca o escribe…' : 'Buscar…') : undefined),
    buscarEn: useTexto(conBuscador ? `Buscar en ${etiqueta || 'la lista'}` : undefined),
    nada: useTexto(abierta && visibles.length === 0 ? `Nada con «${busqueda}»` : undefined),
  };

  const abrir = () => {
    if (disabled) return;
    setBusqueda('');
    const i = Math.max(0, elegibles.findIndex((o) => o.valor === value));
    setActiva(i);
    setAbierta(true);
  };
  const cerrar = (devolverFoco = true) => {
    setAbierta(false);
    if (devolverFoco) window.setTimeout(() => disparador.current?.focus({ preventScroll: true }), 0);
  };
  const elegir = (o) => {
    if (!o || o.deshabilitada) return;
    onChange?.({ target: { value: o.valor } });
    cerrar();
  };

  // Muestra una opción moviendo solo la lista (scrollIntoView movería también
  // la página, y el panel se cierra con el scroll de afuera).
  const mostrar = (el) => {
    const l = lista.current;
    if (!el || !l) return;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight + 4;
  };
  // Al abrir, el foco va al buscador (o a la lista) y la elegida se ve.
  useEffect(() => {
    if (!abierta) return undefined;
    const t = window.setTimeout(() => {
      (buscador.current || lista.current)?.focus({ preventScroll: true });
      mostrar(lista.current?.querySelector('[aria-selected="true"]'));
    }, 60);
    return () => window.clearTimeout(t);
  }, [abierta]);
  useEffect(() => {
    mostrar(lista.current?.querySelector(`[data-indice="${activa}"]`));
  }, [activa]);

  const mover = (paso) => {
    if (!visibles.length) return;
    let i = activa;
    for (let n = 0; n < visibles.length; n += 1) {
      i = (i + paso + visibles.length) % visibles.length;
      if (!visibles[i].deshabilitada) break;
    }
    setActiva(i);
  };
  const teclaLista = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); } else if (e.key === 'Home') { e.preventDefault(); setActiva(0); } else if (e.key === 'End') { e.preventDefault(); setActiva(visibles.length - 1); } else if (e.key === 'Enter') { e.preventDefault(); elegir(visibles[activa]); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); } else if (e.key === 'Tab') { cerrar(false); } else if (!conBuscador && e.key.length === 1) {
      // Escribir salta a la primera opción que empieza así.
      window.clearTimeout(tecleo.current.reloj);
      tecleo.current.texto += sinTildes(e.key);
      tecleo.current.reloj = window.setTimeout(() => { tecleo.current.texto = ''; }, 600);
      const i = visibles.findIndex((o) => sinTildes(o.texto).startsWith(tecleo.current.texto));
      if (i >= 0) setActiva(i);
    }
  };
  const teclaDisparador = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
  };

  return (
    <>
      <button
        ref={disparador}
        id={id}
        type="button"
        className={[s.disparador, compacto && s.compacto, className].filter(Boolean).join(' ')}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierta}
        aria-controls={listaId}
        disabled={disabled}
        onClick={() => (abierta ? cerrar() : abrir())}
        onKeyDown={teclaDisparador}
        {...aria}
      >
        {elegida?.icono && <span className={s.icono}>{elegida.icono}</span>}
        <span className={textoElegido ? s.valor : s.vacio}>{textoElegido || t.vacio}</span>
        <ChevronDown className={[s.flecha, abierta && s.flechaAbierta].filter(Boolean).join(' ')} aria-hidden="true" />
      </button>
      <PanelFlotante abierto={abierta} onCerrar={() => cerrar()} ancla={disparador} titulo={etiqueta || 'Elige una opción'} ancho={compacto ? 260 : 'campo'}>
        <div className={s.contenido}>
          {conBuscador && (
            <label className={s.buscar}>
              <Search aria-hidden="true" />
              <input
                ref={buscador}
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setActiva(0); }}
                onKeyDown={teclaLista}
                placeholder={t.buscar}
                aria-label={t.buscarEn}
                aria-controls={listaId}
                aria-activedescendant={visibles[activa] ? `${listaId}-${activa}` : undefined}
                enterKeyHint="done"
              />
            </label>
          )}
          <ul
            ref={lista}
            id={listaId}
            className={s.lista}
            role="listbox"
            aria-label={t.etiqueta}
            tabIndex={conBuscador ? undefined : -1}
            onKeyDown={conBuscador ? undefined : teclaLista}
            aria-activedescendant={!conBuscador && visibles[activa] ? `${listaId}-${activa}` : undefined}
          >
            {visibles.map((o, i) => {
              const sel = o.valor === value && !o.nueva;
              return (
                <li
                  key={`${o.valor}-${o.nueva ? 'n' : ''}`}
                  id={`${listaId}-${i}`}
                  data-indice={i}
                  role="option"
                  aria-selected={sel}
                  aria-disabled={o.deshabilitada || undefined}
                  className={[s.opcion, i === activa && s.activa, sel && s.elegida, o.deshabilitada && s.apagada, o.nueva && s.nueva].filter(Boolean).join(' ')}
                  onPointerEnter={() => setActiva(i)}
                  onClick={() => elegir(o)}
                >
                  {o.icono && <span className={s.icono}>{o.icono}</span>}
                  <span className={s.textos}>
                    <span>{o.nueva ? <Texto>{o.texto}</Texto> : o.texto}</span>
                    {o.detalle && <small>{o.detalle}</small>}
                  </span>
                  <span className={s.visto} aria-hidden="true">{sel && <Check />}</span>
                </li>
              );
            })}
            {visibles.length === 0 && <li className={s.sinResultados} role="presentation">{t.nada}</li>}
          </ul>
        </div>
      </PanelFlotante>
    </>
  );
}
