import React from 'react';
import { CheckCircle2, Download, Save } from 'lucide-react';
import Boton from '../Boton';
import { Casilla } from '../Formulario';
import { Texto, useTexto } from '../Traduccion';
import { soles } from '../TarjetaProducto';
import { IconoAgregar } from './Ficha';
import s from '../paginas/Estudio.module.css';

/** Las acciones de P12, controladas: comprar continúa con el flujo de la tienda. */
export function CompraEstudio({ precio, combo, vacio, agotado, borradorAdmin, ocupado, hayCambios, yaGuardada, agregado = false, onGuardar, onDescargar, onAgregar, className }) {
  // En español para el texto del botón (Boton lo traduce); traducidos para aria-label y title.
  const textoGuardar = yaGuardada && !hayCambios ? 'Guardado' : yaGuardada ? 'Guardar cambios' : 'Guardar';
  const guardar = useTexto(textoGuardar);
  const descargar = useTexto('Descargar');
  const botonGuardar = { onClick: onGuardar, disabled: vacio || !hayCambios || ocupado, cargando: ocupado === 'guardando', icono: yaGuardada && !hayCambios ? <CheckCircle2 aria-hidden="true" /> : <Save aria-hidden="true" />, 'aria-label': guardar, title: guardar };
  const botonDescargar = { onClick: onDescargar, disabled: vacio || Boolean(ocupado), icono: <Download aria-hidden="true" />, 'aria-label': descargar, title: descargar };
  return (
    <>
      {combo?.opciones?.length > 0 && !vacio && (
        <div className={s.otrasCombo}>
          {combo.opciones.map((opcion) => <Casilla key={opcion.id} activo={opcion.activo} onChange={opcion.onCambiar} etiqueta={<Texto>{opcion.etiqueta}</Texto>} descripcion={<Texto>{opcion.descripcion}</Texto>} />)}
        </div>
      )}
      <div className={[s.compra, className].filter(Boolean).join(' ')} data-compra-fija="">
        <div className={s.compraPrecio}><Texto>{combo ? 'Precio en el combo' : 'Total'}</Texto><strong>{combo ? <Texto>Incluido</Texto> : soles(precio)}</strong></div>
        <Boton bloque icono={combo ? <CheckCircle2 aria-hidden="true" /> : <IconoAgregar agregado={agregado} />} disabled={vacio || agotado || borradorAdmin || Boolean(ocupado)} cargando={ocupado === 'agregando'} onClick={onAgregar}>
          <span className={s.etiquetaAgregar}><Texto>{agotado ? 'Agotado por ahora' : combo ? 'Listo, usar en el combo' : agregado ? '¡Agregado!' : 'Agregar al carrito'}</Texto>{!combo && !agotado && !agregado && <span className={s.precioBoton}> · {soles(precio)}</span>}</span>
        </Boton>
        <div className={s.compraOtras}>
          {!combo && <><Boton {...botonGuardar} variante="contorno" tamano="sm" className={s.soloAncho}>{textoGuardar}</Boton><Boton {...botonGuardar} variante="contorno" tamano="md" soloIcono className={s.soloCelular} /></>}
          <Boton {...botonDescargar} variante="fantasma" tamano="sm" className={s.soloAncho}>Descargar</Boton>
          <Boton {...botonDescargar} variante="contorno" tamano="md" soloIcono className={s.soloCelular} />
        </div>
        {vacio && <p className={s.compraNota}><Texto>Agrega una imagen o un texto para continuar.</Texto></p>}
      </div>
    </>
  );
}
