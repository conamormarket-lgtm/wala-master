import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { getPrendasBase } from '../../../services/prendasBase';
import { crearProductosYoryo, pasarYoryoALaTienda, ajustarTomatodoAFotoNueva, IDS_CREAR_YORYO } from './crearProductosYoryo';
import { crearGrabadosYoryo } from './grabadosYoryo';
import { crearComodasDaida } from './comodasDaida';
import { PRODUCTOS, plantillasDe, leerEditadas, importar as importarPlantillas, limpiar as limpiarCopias } from './pasosYoryo';
import Boton from '../../../componentes/kit/Boton';
import { Aviso } from '../../../componentes/kit/Feedback';
import s from './ImportarPlantillasYoryo.module.css';

/*
 * Una sola vez: el cuadro, el mousepad y el tomatodo de Yoryo en Crear, y sus
 * plantillas (6 equipos y 3 de parejas; en el tomatodo, los 6 escudos para
 * grabar) guardadas en cada producto (prendaBase.plantillas). Son de ese
 * producto: no van a la comunidad ni a Mis creaciones. El cliente las ve en
 * "Empieza con un diseño" del estudio y las cambia a su gusto.
 *
 * Las ediciones que se hicieron en la pantalla anterior (templates/
 * yoryo-composiciones-v4) mandan sobre las de fábrica.
 *
 * Los pasos 2 y 3 (plantillasDe, importar, limpiar) viven en pasosYoryo.js:
 * los comparte con el conector del kit (PlantillasYoryoDelPanel).
 */

export default function ImportarPlantillasYoryoViejo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prendas = useQuery({ queryKey: ['admin-prendas-crear-importar'], queryFn: async () => (await getPrendasBase({ incluirBorradores: true })).data });
  const editadas = useQuery({
    queryKey: ['plantillas-yoryo-editadas'],
    queryFn: leerEditadas,
  });
  const [destinoElegido, setDestino] = useState({});
  // Si ya existen los productos de Crear, se eligen solos.
  const destino = useMemo(() => Object.fromEntries(PRODUCTOS.map(([p]) => [p,
    destinoElegido[p] ?? ((prendas.data || []).some((x) => x.id === IDS_CREAR_YORYO[p]) ? IDS_CREAR_YORYO[p] : '')])), [destinoElegido, prendas.data]);
  const [pasoProductos, setPasoProductos] = useState('');
  const [creandoProductos, setCreandoProductos] = useState(false);
  const crearProductos = async () => {
    setCreandoProductos(true);
    try {
      await crearProductosYoryo({ onPaso: setPasoProductos });
      await prendas.refetch();
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoProductos(`Error: ${e.message}`);
    } finally {
      setCreandoProductos(false);
    }
  };
  // 4. Pasar a la tienda: los de Crear salen en la tienda y los de antes se ocultan.
  const [pasoTienda, setPasoTienda] = useState('');
  const [pasandoATienda, setPasandoATienda] = useState(false);
  const pasarATienda = async () => {
    if (!window.confirm('¿Pasar el cuadro, el mousepad, el tomatodo y el Pack de oficina de Crear a la tienda? Sus productos de la tienda de antes se ocultan (sus enlaces llevan a los nuevos).')) return;
    setPasandoATienda(true);
    try {
      await pasarYoryoALaTienda({ onPaso: setPasoTienda });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoTienda(`Error: ${e.message}`);
    } finally {
      setPasandoATienda(false);
    }
  };
  // 5. El tomatodo sobre la foto nueva (zona, referencia y miniaturas).
  const [pasoTomatodo, setPasoTomatodo] = useState('');
  const [ajustandoTomatodo, setAjustandoTomatodo] = useState(false);
  const ajustarTomatodo = async () => {
    setAjustandoTomatodo(true);
    try {
      await ajustarTomatodoAFotoNueva({ onPaso: setPasoTomatodo });
      queryClient.invalidateQueries({ queryKey: ['prenda-base'] });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    } catch (e) {
      setPasoTomatodo(`Error: ${e.message}`);
    } finally {
      setAjustandoTomatodo(false);
    }
  };
  // 6. La billetera y la esclava grabadas, y los packs con el reloj tal cual.
  const [pasoGrabados, setPasoGrabados] = useState('');
  const [creandoGrabados, setCreandoGrabados] = useState(false);
  const crearGrabados = async () => {
    setCreandoGrabados(true);
    try {
      await crearGrabadosYoryo({ onPaso: setPasoGrabados });
      queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
      queryClient.invalidateQueries({ queryKey: ['prenda-base'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-combos-crear'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e) {
      setPasoGrabados(`Error: ${e.message}`);
    } finally {
      setCreandoGrabados(false);
    }
  };
  // 7. Las cómodas de Daida Hogar.
  const [pasoDaida, setPasoDaida] = useState('');
  const [creandoDaida, setCreandoDaida] = useState(false);
  const crearDaida = async () => {
    setCreandoDaida(true);
    try {
      await crearComodasDaida({ onPaso: setPasoDaida });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (e) {
      setPasoDaida(`Error: ${e.message}`);
    } finally {
      setCreandoDaida(false);
    }
  };
  const [elegidas, setElegidas] = useState(() => new Set(PRODUCTOS.flatMap(([p]) => plantillasDe(p).map((x) => x.id))));
  const [estado, setEstado] = useState({});
  const [trabajando, setTrabajando] = useState(false);

  const importar = async () => {
    setTrabajando(true);
    setEstado({});
    const marcar = (id, texto) => setEstado((m) => ({ ...m, [id]: texto }));
    await importarPlantillas({ destino, elegidas, prendas: prendas.data, editadas: editadas.data, marcar });
    queryClient.invalidateQueries({ queryKey: ['prendas-base'] });
    setTrabajando(false);
  };

  // Las copias que la versión anterior de esta pantalla publicó en la
  // comunidad (y guardó en Mis creaciones de tu cuenta): se retiran y se borran.
  const [limpieza, setLimpieza] = useState('');
  const limpiar = async () => {
    try {
      const texto = await limpiarCopias(user.uid, setLimpieza);
      queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'] });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'] });
      setLimpieza(texto);
    } catch (e) {
      setLimpieza(`Error: ${e.message}`);
    }
  };

  const opciones = (prendas.data || []).filter((p) => p.prendaBase?.vistas?.length);
  const listas = PRODUCTOS.some(([p]) => destino[p]);
  return (
    <div className={s.pagina}>
      <h1>Cuadros, mousepads y tomatodos en Crear</h1>
      <p>
        Pone los productos de Yoryo en Crear con sus plantillas. Las plantillas son de cada producto: el cliente las ve en el
        estudio, en <em>Empieza con un diseño</em>, separadas en Parejas y Equipos, y cambia la foto, los textos o lo que quiera.
        No aparecen en la comunidad ni en Mis creaciones. Luego se renombran o quitan en Admin → Productos → Personalizables
        (pestaña Plantillas de cada uno).
      </p>
      <section className={s.grupo}>
        <h2>1. Los productos en Crear</h2>
        <p>
          Crea el cuadro (31 × 25 cm), el mousepad (23.5 × 19.5 cm) y el tomatodo grabado como productos de Crear, con la foto
          de la tienda sin fondo, y el Pack de oficina como combo. También hace que <em>Personalizar</em> de esos productos de la
          tienda lleve a ellos. Lo que ya exista no se repite.
        </p>
        <Boton variante="contorno" onClick={crearProductos} cargando={creandoProductos} disabled={!user || trabajando}>Crear productos y pack</Boton>
        {pasoProductos && <small className={pasoProductos.startsWith('Error') ? s.error : undefined}>{pasoProductos}</small>}
      </section>

      <h2 className={s.subtitulo}>2. Las plantillas</h2>
      <Aviso tipo="info" compacto>
        Volver a guardarlas reemplaza las mismas plantillas (no se duplican).
      </Aviso>

      <div className={s.destinos}>
        {PRODUCTOS.map(([producto, nombre]) => (
          <label key={producto}>
            <span>{nombre} de Crear</span>
            <select value={destino[producto]} disabled={trabajando} onChange={(e) => setDestino((d) => ({ ...d, [producto]: e.target.value }))}>
              <option value="">No importar</option>
              {opciones.map((p) => <option key={p.id} value={p.id}>{p.name}{p.visible === false ? ' (borrador)' : ''}</option>)}
            </select>
          </label>
        ))}
      </div>

      {PRODUCTOS.filter(([p]) => destino[p]).map(([producto, nombre]) => (
        <section key={producto} className={s.grupo}>
          <h2>{nombre}</h2>
          <ul>
            {plantillasDe(producto).map((x) => (
              <li key={x.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={elegidas.has(x.id)}
                    disabled={trabajando}
                    onChange={(e) => setElegidas((prev) => {
                      const sig = new Set(prev);
                      if (e.target.checked) sig.add(x.id); else sig.delete(x.id);
                      return sig;
                    })}
                  />
                  {x.grupo} · {x.nombre}
                </label>
                {estado[x.id] && <small className={estado[x.id].startsWith('Error') ? s.error : undefined}>{estado[x.id]}</small>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Boton onClick={importar} cargando={trabajando} disabled={!listas || !user || prendas.isLoading || editadas.isLoading}>
        Guardar plantillas en los productos
      </Boton>

      <section className={s.grupo}>
        <h2>3. Quitar las copias de la comunidad</h2>
        <p>
          La versión anterior de esta pantalla publicó las plantillas en la comunidad y las guardó en tus creaciones. Esto las
          retira de la comunidad y las borra de Mis creaciones. Las plantillas de los productos no se tocan.
        </p>
        <Boton variante="contorno" onClick={limpiar} disabled={!user || trabajando || limpieza.startsWith('Quitando')}>Quitar copias</Boton>
        {limpieza && <small className={limpieza.startsWith('Error') ? s.error : undefined}>{limpieza}</small>}
      </section>

      <section className={s.grupo}>
        <h2>4. Pasarlos a la tienda</h2>
        <p>
          Desde ahora cada uno es un solo producto: el de Crear sale también en la tienda y en la página de Yoryo, con las
          fotos, la descripción, la categoría y las etiquetas del de la tienda, y su botón es <em>Personalízalo</em>. El Pack
          de oficina igual, con su portada. Los cuatro productos de la tienda de antes se ocultan; sus enlaces llevan a los
          nuevos. Hazlo después de los pasos 1 y 2.
        </p>
        <Boton variante="contorno" onClick={pasarATienda} cargando={pasandoATienda} disabled={!user || trabajando || creandoProductos}>Pasar a la tienda</Boton>
        {pasoTienda && <small className={pasoTienda.startsWith('Error') ? s.error : undefined}>{pasoTienda}</small>}
      </section>

      <section className={s.grupo}>
        <h2>5. El tomatodo con la foto nueva</h2>
        <p>
          Para el vaso negro con asa sin fondo (1086 × 1448) subido como foto propia del color: pone la zona de grabado
          centrada en el cuerpo (sin tocar el aro ni el asa), la línea de referencia de borde a borde y esa foto como base, y
          rehace las miniaturas de sus plantillas. Las plantillas siguen en su lugar.
        </p>
        <Boton variante="contorno" onClick={ajustarTomatodo} cargando={ajustandoTomatodo} disabled={!user || trabajando}>Ajustar el tomatodo</Boton>
        {pasoTomatodo && <small className={pasoTomatodo.startsWith('Error') ? s.error : undefined}>{pasoTomatodo}</small>}
      </section>

      <section className={s.grupo}>
        <h2>6. Billetera y esclava grabadas</h2>
        <p>
          Crea la billetera Cónsul y la esclava grabadas con láser como productos de Crear, con sus plantillas: iniciales o
          nombre con un símbolo (flecha, infinito, estrella, corazón, rayo o montaña), con fecha, solo el texto o en letra
          escrita. Después junta cada uno con su ficha de la tienda en <strong>una sola ficha</strong>: sale en la tienda con
          <em> Agregar al carrito</em> (tal cual, al mismo precio) y <em>Personalízalo</em>, con el nombre, la descripción, el
          precio, el stock y la categoría de la tienda. La ficha de tienda de antes queda como reemplazada: la web lleva a la
          nueva, y la app de Android y los combos la siguen usando. También arma los combos Ónix, Oro y Medianoche como packs de
          Crear con el reloj tal cual. Las medidas en cm son estimadas: corrígelas en la ficha (pestaña Diseño) cuando el taller
          las confirme. Lo que ya exista no se repite; las plantillas y las fotos se rehacen.
        </p>
        <Boton variante="contorno" onClick={crearGrabados} cargando={creandoGrabados} disabled={!user || trabajando}>Crear billetera, esclava y packs</Boton>
        {pasoGrabados && <small className={pasoGrabados.startsWith('Error') ? s.error : undefined}>{pasoGrabados}</small>}
      </section>

      <section className={s.grupo}>
        <h2>7. Cómodas de Daida Hogar</h2>
        <p>
          Sube la cómoda de 4 cajones (S/ 450) y las dos de 8 cajones, de 140 cm y de 120 cm de ancho (S/ 590 cada una), a la
          marca Daida Hogar, con stock 4 cada una y tres colores (blanco, nogal y blanco, roble y blanco), con su foto en ángulo
          y de frente. La de 8 cajones que ya estaba pasa a llamarse «Cómoda de 8 cajones · 140 cm». Crea la categoría
          <em> Cómodas</em> de la marca y el tipo <em>Mueble</em> si no existen. Lo que ya exista no se repite; después se
          edita en Admin → Productos como cualquier producto.
        </p>
        <Boton variante="contorno" onClick={crearDaida} cargando={creandoDaida} disabled={!user || trabajando}>Subir las cómodas</Boton>
        {pasoDaida && <small className={pasoDaida.startsWith('Error') ? s.error : undefined}>{pasoDaida}</small>}
      </section>
    </div>
  );
}
