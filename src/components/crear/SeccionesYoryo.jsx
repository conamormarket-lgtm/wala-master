import React from 'react';
import { AlignCenter, RotateCcw } from 'lucide-react';
import { Campo, Casilla, Deslizador } from '../../componentes/kit/Formulario';
import Boton from '../../componentes/kit/Boton';
import { Pestanas } from '../../componentes/kit/Navegacion';
import { Texto } from '../../componentes/kit/Traduccion';
import { Aviso } from '../../componentes/kit/Feedback';
import { FUENTES_YORYO, ajusteSeccion, seccionesYoryo } from '../../utils/distribucionYoryo.mjs';
import s from './PersonalizadorYoryo.module.css';

export default function SeccionesYoryo({ datos, config, elementos = [], activa, onActiva, onCambiar, onRestablecer, contenidos, disabled }) {
  const secciones = seccionesYoryo(datos, config);
  const seccion = secciones.find((e) => e.id === activa) || secciones.find((e) => e.id === 'nombre');
  const ajuste = ajusteSeccion(datos, seccion);
  const sujeto = `${['Escudo', 'Equipo', 'Nombre'].includes(seccion.nombre) ? 'del' : seccion.nombre === 'Iniciales' ? 'de las' : 'de la'} ${seccion.nombre.toLowerCase()}`;
  const esTexto = seccion.fuente && !(seccion.id === 'escudo' && datos.plantilla === 'escudo');
  const elegido = elementos.find((e) => e.id === seccion.id);
  const superpuesto = config.tecnica === 'laser' && elegido && elementos.find((e) => e.id !== elegido.id && Math.max(0, Math.min(e.x + e.w, elegido.x + elegido.w) - Math.max(e.x, elegido.x)) * Math.max(0, Math.min(e.y + e.h, elegido.y + elegido.h) - Math.max(e.y, elegido.y)) > Math.min(e.w * e.h, elegido.w * elegido.h) * .08);
  return <section className={s.secciones} aria-label="Personaliza por secciones">
    <div><h2 className={s.tituloSecciones}><Texto>Personaliza por secciones</Texto></h2><p className={s.nota}><Texto>Elige una sección o tócala en el producto. Puedes arrastrarla dentro del área marcada.</Texto></p></div>
    <Pestanas etiqueta="Sección del diseño" opciones={secciones.map((e) => ({ id: e.id, texto: e.nombre }))} valor={seccion.id} onChange={onActiva} />
    <div className={s.campos} key={seccion.id}>
      {contenidos[seccion.id]}
      {esTexto && <>
        <Campo etiqueta={`Letra ${sujeto}`} opciones={FUENTES_YORYO.map((f) => ({ valor: f.id, texto: f.id, detalle: f.detalle, icono: <span aria-hidden="true" className={s.muestraFuente} style={{ fontFamily: `'${f.familia}'` }}>Aa</span> }))} value={ajuste.fuente} disabled={disabled} onChange={(e) => onCambiar(seccion.id, { fuente: e.target.value })} />
        <Casilla etiqueta="Usar mayúsculas" activo={ajuste.mayusculas} disabled={disabled} onChange={(mayusculas) => onCambiar(seccion.id, { mayusculas })} />
      </>}
      <Deslizador etiqueta={`Tamaño ${sujeto}`} valor={ajuste.escala} min={40} max={160} paso={5} formato={(v) => `${v}%`} disabled={disabled} onChange={(escala) => onCambiar(seccion.id, { escala })} />
      <div className={s.tamanos} role="group" aria-label="Tamaños rápidos">
        {[['Pequeño', 70], ['Equilibrado', 100], ['Grande', 125]].map(([nombre, escala]) => <button key={nombre} type="button" className={ajuste.escala === escala ? s.tamanoActivo : undefined} aria-pressed={ajuste.escala === escala} disabled={disabled} onClick={() => onCambiar(seccion.id, { escala })}>{nombre}</button>)}
      </div>
      <div className={s.accionesSeccion}>
        <Boton variante="contorno" tamano="sm" icono={<AlignCenter />} disabled={disabled} onClick={() => onCambiar(seccion.id, { x: .5 })}><Texto>Centrar sección</Texto></Boton>
        <Boton variante="fantasma" tamano="sm" icono={<RotateCcw />} disabled={disabled} onClick={() => onCambiar(seccion.id, { x: seccion.x, y: seccion.y, escala: 100, fuente: seccion.fuente || '', mayusculas: seccion.mayusculas ?? false })}><Texto>Restablecer sección</Texto></Boton>
      </div>
      <p className={s.nota}><Texto>El tamaño se adapta al texto y al espacio disponible para mantenerlo dentro del área.</Texto></p>
      {superpuesto && <Aviso tipo="aviso" compacto>{`${seccion.nombre} se superpone con ${superpuesto.nombre.toLowerCase()}. Mueve o reduce la sección, o aplica la distribución recomendada.`}</Aviso>}
    </div>
    <Boton variante="fantasma" tamano="sm" disabled={disabled} onClick={onRestablecer}><Texto>Distribución recomendada</Texto></Boton>
  </section>;
}
