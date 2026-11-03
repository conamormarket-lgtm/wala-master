import React, { useState } from 'react';
import { Aviso } from '../../Feedback';
import { Campo, Casilla } from '../../Formulario';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { PasoAdmin } from '../../piezas/admin/Pasos';
import s from './Herramientas.module.css';

/*
 * D2d: la página de una sola vez de los productos de Yoryo y Daida
 * ("Plantillas de cuadros"). Blueprints salió del admin el 2026-11-03.
 */

/**
 * La página de una sola vez de /admin/plantillas-yoryo: siete pasos, cada uno
 * con su botón y lo que va pasando. Lo que hace cada paso no cambia (son los
 * scripts de pages/admin/plantillasYoryo); el kit solo pone cómo se ve.
 *  - productos: [{ id: 'cuadro', nombre: 'Cuadro' }…] · prendas: [{ id, nombre, borrador }] (destinos posibles)
 *  - destinosIniciales: { cuadro: prendaId } (los que ya existen) · plantillas: { cuadro: [{ id, grupo, nombre }] }
 *  - cargando · sinSesion (los pasos piden la sesión del admin); un paso a la vez
 *  - onCrearProductos(avisar) · onGuardarPlantillas({ destinos, elegidas }, marcar(id, texto)) ·
 *    onQuitarCopias(avisar) · onPasarATienda(avisar) · onAjustarTomatodo(avisar) ·
 *    onCrearGrabados(avisar) · onCrearComodas(avisar): promesas (el texto que devuelven queda como resultado)
 */
export function PaginaPlantillasYoryo({
  productos = [], prendas = [], destinosIniciales = {}, plantillas = {}, cargando, sinSesion = false,
  onCrearProductos, onGuardarPlantillas, onQuitarCopias, onPasarATienda, onAjustarTomatodo, onCrearGrabados, onCrearComodas,
}) {
  const [destinos, setDestinos] = useState({});
  const [elegidas, setElegidas] = useState(() => new Set(Object.values(plantillas).flat().map((p) => p.id)));
  const [estado, setEstado] = useState({});
  const destinoDe = (id) => destinos[id] ?? destinosIniciales[id] ?? '';
  const hayDestino = productos.some((p) => destinoDe(p.id));
  const marcar = (id, texto) => setEstado((m) => ({ ...m, [id]: texto }));
  // Un paso a la vez (como antes): mientras uno corre, los demás esperan.
  const [trabajando, setTrabajando] = useState(false);
  const uno = (fn) => fn && (async (...args) => {
    setTrabajando(true);
    try { return await fn(...args); } finally { setTrabajando(false); }
  });
  const bloqueado = sinSesion || trabajando;
  const sinSesionTexto = sinSesion ? 'Entra con tu cuenta de admin.' : trabajando ? 'Espera a que termine el otro paso.' : undefined;

  return (
    <div className={s.pasos} data-componente="PaginaPlantillasYoryo">
      <CabezaAdmin icono="plantillas" titulo="Plantillas de cuadros" subtitulo="Una sola vez: los productos de Yoryo y Daida en Crear con sus plantillas. Después se cambian en Productos › Personalizables." />
      <Aviso tipo="info" compacto>Cada paso se puede repetir: lo que ya existe no se duplica (volver a guardar plantillas reemplaza las mismas).</Aviso>

      <PasoAdmin numero={1} titulo="Los productos en Crear" boton={{ texto: 'Crear productos y pack' }} onEjecutar={uno(onCrearProductos)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Crea el cuadro (31 × 25 cm), el mousepad (23.5 × 19.5 cm) y el tomatodo grabado como productos de Crear, con la foto de la tienda sin fondo, y el Pack de oficina como combo. También hace que «Personalizar» de esos productos de la tienda lleve a ellos.
      </PasoAdmin>

      <PasoAdmin
        numero={2}
        titulo="Sus plantillas"
        boton={{ texto: 'Guardar las plantillas', variante: 'primario' }}
        onEjecutar={uno(() => onGuardarPlantillas?.({ destinos: Object.fromEntries(productos.map((p) => [p.id, destinoDe(p.id)])), elegidas: [...elegidas] }, marcar))}
        deshabilitado={bloqueado || cargando || !hayDestino}
        motivo={bloqueado ? sinSesionTexto : !hayDestino ? 'Elige al menos un producto de destino.' : undefined}
        contenido={(
          <>
            <div className={s.destinos}>
              {productos.map((p) => (
                <Campo
                  key={p.id}
                  etiqueta={`${p.nombre} de Crear`}
                  opciones={[{ valor: '', texto: 'No importar' }, ...prendas.map((x) => ({ valor: x.id, texto: `${x.nombre}${x.borrador ? ' (borrador)' : ''}` }))]}
                  value={destinoDe(p.id)}
                  onChange={(e) => setDestinos((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              ))}
            </div>
            {productos.filter((p) => destinoDe(p.id)).map((p) => (
              <div key={p.id} className={s.plantillas}>
                <strong>{p.nombre}</strong>
                {(plantillas[p.id] || []).map((x) => (
                  <div key={x.id} className={s.plantilla}>
                    <Casilla
                      etiqueta={`${x.grupo} · ${x.nombre}`}
                      activo={elegidas.has(x.id)}
                      onChange={(si) => setElegidas((prev) => { const n = new Set(prev); if (si) n.add(x.id); else n.delete(x.id); return n; })}
                    />
                    {estado[x.id] && <span className={/^Error/.test(estado[x.id]) ? s.malo : s.bueno}>{estado[x.id]}</span>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      >
        En cada producto, sus plantillas (6 de equipos y 3 de parejas; en el tomatodo, los 6 escudos para grabar). El cliente las ve en el estudio, en «Empieza con un diseño». No van a la comunidad ni a Mis creaciones.
      </PasoAdmin>

      <PasoAdmin numero={3} titulo="Quitar las copias de la comunidad" boton={{ texto: 'Quitar copias' }} onEjecutar={uno(onQuitarCopias)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        La versión anterior de esta página publicó las plantillas en la comunidad y las guardó en tus creaciones: esto las retira y las borra de Mis creaciones. Las plantillas de los productos no se tocan.
      </PasoAdmin>

      <PasoAdmin
        numero={4}
        titulo="Pasarlos a la tienda"
        boton={{ texto: 'Pasar a la tienda' }}
        onEjecutar={uno(onPasarATienda)}
        deshabilitado={bloqueado}
        motivo={sinSesionTexto}
        confirmar={{ titulo: '¿Pasar el cuadro, el mousepad, el tomatodo y el Pack de oficina a la tienda?', texto: 'Sus productos de la tienda de antes se ocultan; sus enlaces llevan a los nuevos.', confirmar: 'Pasarlos' }}
      >
        Cada uno queda como un solo producto: el de Crear sale también en la tienda y en la página de Yoryo, con las fotos, la descripción, la categoría y las etiquetas del de la tienda, y su botón es «Personalízalo». Hazlo después de los pasos 1 y 2.
      </PasoAdmin>

      <PasoAdmin numero={5} titulo="Ajustar el tomatodo a su foto nueva" boton={{ texto: 'Ajustar el tomatodo' }} onEjecutar={uno(onAjustarTomatodo)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Rehace la zona, la medida de referencia y las miniaturas de sus plantillas sobre la foto nueva del tomatodo.
      </PasoAdmin>

      <PasoAdmin numero={6} titulo="Billetera, esclava y packs" boton={{ texto: 'Crear los grabados' }} onEjecutar={uno(onCrearGrabados)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        La billetera y la esclava como una sola ficha que se vende tal cual y grabada (las de antes quedan reemplazadas), y los packs con el reloj tal cual.
      </PasoAdmin>

      <PasoAdmin numero={7} titulo="Cómodas de Daida Hogar" boton={{ texto: 'Crear las cómodas' }} onEjecutar={uno(onCrearComodas)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Las tres cómodas (las de 8 cajones con el ancho en el nombre), su categoría y su tipo de producto.
      </PasoAdmin>
    </div>
  );
}
