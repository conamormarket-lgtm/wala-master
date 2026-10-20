import React from 'react';
import { CheckCircle2, Images, LogIn, Save, ShoppingBag } from 'lucide-react';
import Boton from '../Boton';
import { HojaInferior } from '../Feedback';
import { Campo, Cantidad, SelectorTalla } from '../Formulario';
import { Texto } from '../Traduccion';
import { TextoResaltado } from './TextoResaltado';
import { soles } from '../TarjetaProducto';
import s from '../paginas/Estudio.module.css';

/** Las hojas de P12 reciben sus valores y acciones; no guardan ni leen datos. */
export function HojasEstudio({
  prenda, color, precio, tallas, talla, onTalla, pidiendoTalla, onCerrarTalla, onComprar,
  guardando, onCerrarGuardar, nombre, onNombre, onGuardar, miniatura,
  guardada, onCerrarGuardada, urlCombo, login, onCerrarLogin, onLogin, onRegistro,
  cantidad = 1, onCantidad, ocupado, vistaPrevia, urlCreacion, onVolverCombo,
  urlLogin, urlRegistro, motivoLogin,
}) {
  // Los títulos y los textos del campo van en español: HojaInferior y Campo los traducen.
  const tituloLogin = motivoLogin === 'guardar' ? 'Inicia sesión para guardar' : 'Inicia sesión para continuar';
  return (
    <>
      <HojaInferior abierta={pidiendoTalla} onCerrar={onCerrarTalla} titulo="Elige la talla"
        pie={<Boton bloque icono={<ShoppingBag aria-hidden="true" />} disabled={!talla} cargando={ocupado === 'agregando'} onClick={onComprar}><Texto>Agregar al carrito</Texto> · {soles(precio * cantidad)}</Boton>}>
        <div className={s.hojaTalla}>
          <p><Texto>{prenda}</Texto> · <Texto>{color}</Texto></p>
          <p className={s.compraNota}><Texto>Incluye la impresión de todos tus diseños.</Texto></p>
          <SelectorTalla tallas={tallas} valor={talla} onChange={onTalla} />
          {onCantidad && <div className={s.filaCantidad}><Texto>Cantidad</Texto><Cantidad valor={cantidad} onChange={onCantidad} min={1} max={20} /></div>}
        </div>
      </HojaInferior>
      <HojaInferior abierta={guardando} onCerrar={onCerrarGuardar} titulo="Guarda tu creación"
        pie={<Boton bloque icono={<Save aria-hidden="true" />} cargando={ocupado === 'guardando'} onClick={onGuardar}><Texto>Guardar</Texto></Boton>}>
        <form className={s.hojaGuardar} onSubmit={(e) => { e.preventDefault(); onGuardar(); }}>
          {vistaPrevia ? <div className={s.miniatura}>{vistaPrevia}</div> : miniatura && <img className={s.miniatura} src={miniatura} alt="" />}
          <Campo etiqueta="Ponle un nombre" maxLength={60} value={nombre} onChange={(e) => onNombre(e.target.value)} ayuda="Lo verás en Mis creaciones." autoFocus />
          <button type="submit" hidden />
        </form>
      </HojaInferior>
      <HojaInferior abierta={Boolean(guardada)} onCerrar={onCerrarGuardada} titulo="¡Creación guardada!" pie={(
        <div className={s.pieGuardada}>
          <Boton bloque icono={urlCombo || onVolverCombo ? <CheckCircle2 aria-hidden="true" /> : <Images aria-hidden="true" />} onClick={onVolverCombo} to={onVolverCombo ? undefined : urlCombo || urlCreacion || (guardada?.id ? '/creacion/' + guardada.id : '/cuenta/creaciones')}><Texto>{urlCombo || onVolverCombo ? 'Volver al combo' : urlCreacion || guardada?.id ? 'Ver mi creación' : 'Ver mis creaciones'}</Texto></Boton>
          <Boton bloque variante="fantasma" onClick={onCerrarGuardada}><Texto>Seguir diseñando</Texto></Boton>
        </div>
      )}>
        <div className={s.hojaGuardar}>
          {vistaPrevia ? <div className={s.miniatura}>{vistaPrevia}</div> : guardada?.imagenConjunta && <img className={s.miniatura} src={guardada.imagenConjunta} alt="" />}
          <p className={s.guardadaTexto}><TextoResaltado resaltar={[guardada?.name]}>{`${guardada?.name || ''} ya está en Mis creaciones. Puedes volver a editarla cuando quieras.`.trim()}</TextoResaltado></p>
        </div>
      </HojaInferior>
      <HojaInferior abierta={login} onCerrar={onCerrarLogin} titulo={tituloLogin} pie={(
        <div className={s.pieGuardada}>
          <Boton bloque icono={<LogIn aria-hidden="true" />} onClick={onLogin} to={urlLogin}><Texto>Iniciar sesión</Texto></Boton>
          <Boton bloque variante="contorno" onClick={onRegistro} to={urlRegistro}><Texto>Crear una cuenta</Texto></Boton>
          <Boton bloque variante="fantasma" onClick={onCerrarLogin}><Texto>Seguir diseñando</Texto></Boton>
        </div>
      )}>
        <div className={s.hojaLogin}><p><Texto>Así guardamos tus imágenes y tu diseño. Tus textos y elecciones se quedan como los dejaste.</Texto></p></div>
      </HojaInferior>
    </>
  );
}
