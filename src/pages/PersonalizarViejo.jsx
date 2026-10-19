import React, { useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shirt, Upload, ShoppingBag, ArrowRight, Paintbrush, Users, User } from 'lucide-react';
import { getPrendasBase } from '../services/prendasBase';
import { getCombosCrear } from '../services/combosCrear';
import { preciosDeCombo } from './Crear/comboCrear';
import { EtiquetaColgante } from '../componentes/kit/Marca';
import { getDesignsByUser } from '../services/designs';
import { useAuth } from '../contexts/AuthContext';
import { useAlternarFotos } from '../hooks/useAlternarFotos';
import { useAlVerUnaVez } from '../hooks/useAlVerUnaVez';
import { leerPrendaBase, precioBase, colorDisponible, fondoMuestra } from '../utils/prendaBase';
import { useEliminarCreacion } from './Crear/useEliminarCreacion';
import TusBorradores, { useBorradoresCrear } from './Crear/TusBorradores';
import FilaCarrusel from './Crear/FilaCarrusel';
import MiCreacionCard, { fechaDeCreacion } from './cuenta/components/MiCreacionCard';
import TarjetaComunidad, { useComunidad } from './Comunidad/TarjetaComunidad';
import TarjetaMiCombo from './Crear/TarjetaMiCombo';
import { esMiCombo, agruparCombos } from '../services/misCombos';
import { useEliminarMiCombo } from './Crear/useEliminarMiCombo';
import { useVersionesReemplazadas } from './Crear/useVersionesReemplazadas';
import { atributosDeFoto, SIZES_TARJETA_PRODUCTO } from '../components/common/OptimizedImage/OptimizedImage';
import styles from './PersonalizarPage.module.css';
import { T } from '../i18n/useTranslatedText';

const PASOS = [
  { icono: Shirt, titulo: 'Elige tu prenda', texto: 'Color y talla' },
  { icono: Upload, titulo: 'Diseña', texto: 'Sube tu imagen o escribe un texto' },
  { icono: ShoppingBag, titulo: 'Recíbela', texto: 'La imprimimos y te la enviamos' },
];

const TarjetaPrenda = ({ prenda }) => {
  const leida = leerPrendaBase(prenda);
  const { vistas } = leida;
  const colores = leida.colores.filter((c) => colorDisponible(c, vistas));
  const frente = vistas[0]?.imagen;
  const espalda = vistas[1]?.imagen;
  const lados = vistas.map((v) => v.nombre).filter(Boolean);
  // En el celular frente y espalda alternan solas (en escritorio, al pasar el mouse).
  const fotoRef = useRef(null);
  const verEspalda = useAlternarFotos(fotoRef, Boolean(frente && espalda));
  return (
    <Link to={`/crear/${prenda.id}`} className={styles.tarjeta}>
      <div ref={fotoRef} className={`${styles.foto} ${verEspalda ? styles.fotoConEspalda : ''}`}>
        {prenda.visible === false && <span className={styles.borrador}>Borrador</span>}
        {frente && <img {...atributosDeFoto(frente, SIZES_TARJETA_PRODUCTO)} alt={prenda.name} className={styles.fotoFrente} loading="lazy" />}
        {espalda && <img {...atributosDeFoto(espalda, SIZES_TARJETA_PRODUCTO)} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
        {frente && espalda && (
          <span className={styles.puntosFoto} aria-hidden="true">
            <span className={`${styles.puntoFoto} ${!verEspalda ? styles.puntoFotoActivo : ''}`} />
            <span className={`${styles.puntoFoto} ${verEspalda ? styles.puntoFotoActivo : ''}`} />
          </span>
        )}
        {lados.length > 0 && (
          <span className={styles.lados} title="Lados que puedes diseñar">{lados.join(' + ')}</span>
        )}
      </div>
      <div className={styles.info}>
        <h2 className={styles.nombre}>{prenda.name}</h2>
        <div className={styles.colores}>
          {colores.slice(0, 7).map((c) => (
            <span
              key={c.id}
              className={styles.punto}
              style={{ background: fondoMuestra(c) }}
              title={c.nombre}
            />
          ))}
          {colores.length > 7 && <span className={styles.mas}>+{colores.length - 7}</span>}
        </div>
        <p className={styles.cantidadColores}>
          {colores.length} {colores.length === 1 ? 'color' : 'colores'} · tu imagen o tu frase
        </p>
        <div className={styles.pie}>
          <div className={styles.precios}>
            <span className={styles.desde}>Desde</span>
            <span className={styles.precio}>S/ {precioBase(prenda).toFixed(2)}</span>
          </div>
          <span className={styles.cta}><Paintbrush size={15} aria-hidden="true" /> Diseñar</span>
        </div>
      </div>
    </Link>
  );
};

/**
 * Un combo (pareja, trío…): sus prendas juntas, el precio del paquete y
 * cuánto se ahorra frente a comprarlas sueltas.
 */
const TarjetaCombo = ({ combo, prendas }) => {
  const { precio, sueltas, ahorro } = preciosDeCombo(combo, prendas);
  const nombres = [...new Set(prendas.map((p) => p.name))];
  const fotoRef = useRef(null);
  const visto = useAlVerUnaVez(fotoRef);
  return (
    // "Armar" empieza un combo limpio, como "Diseñar" en una prenda suelta.
    <Link to={`/combo/${combo.id}?nuevo=1`} className={styles.tarjeta}>
      <div className={styles.foto}>
        {!combo.publicado && <span className={styles.borrador}>Borrador</span>}
        <span ref={fotoRef} className={`${styles.prendasCombo} ${visto ? styles.saludo : ''}`} style={{ '--n': prendas.length }}>
          {prendas.map((p, i) => {
            const img = leerPrendaBase(p).vistas[0]?.imagen || p.mainImage;
            return img ? <img key={`${p.id}-${i}`} {...atributosDeFoto(img, '240px')} alt="" aria-hidden="true" loading="lazy" /> : null;
          })}
        </span>
        <span className={styles.lados}><Users size={12} aria-hidden="true" /> {prendas.length} prendas</span>
        {ahorro > 0 && (
          <EtiquetaColgante tono="magenta" tamano="sm" className={styles.ahorroCombo}>Ahorras S/ {ahorro.toFixed(2)}</EtiquetaColgante>
        )}
      </div>
      <div className={styles.info}>
        <h2 className={styles.nombre}>{combo.name}</h2>
        <p className={styles.cantidadColores}>{nombres.join(' + ')} · cada una con su diseño</p>
        <div className={styles.pie}>
          <div className={styles.precios}>
            {ahorro > 0 && <span className={styles.desde}>Por separado <s className={styles.tachado}>S/ {sueltas.toFixed(2)}</s></span>}
            <span className={styles.precio}>S/ {precio.toFixed(2)}</span>
          </div>
          <span className={styles.cta}><Paintbrush size={15} aria-hidden="true" /> Armar</span>
        </div>
      </div>
    </Link>
  );
};

/**
 * Nombre de cada opción del selector "¿Para cuántos?". Si los combos de ese
 * tamaño mezclan prendas distintas (casaca + polo + jogger) son un conjunto
 * para una persona, no prendas iguales para varias.
 */
const etiquetaPara = (n, conjunto) => {
  if (n === 1) return 'Para ti';
  if (conjunto) return 'Conjunto';
  return n === 2 ? 'En pareja' : `Para ${n}`;
};
const esConjunto = (combo) => new Set(combo.piezas.map((p) => p.prendaId)).size > 1;

/**
 * Las últimas creaciones del cliente, arriba de las prendas: así vuelve a lo
 * suyo desde donde empieza a diseñar, sin pasar por su cuenta.
 */
const useCreacionesCrear = (uid) => useQuery({
  queryKey: ['mis-creaciones-crear', uid],
  enabled: Boolean(uid),
  // Al volver del estudio se ve lo recién guardado (la app no recarga al montar por defecto).
  refetchOnMount: 'always',
  queryFn: async () => {
    const { data } = await getDesignsByUser(uid);
    // Creaciones de Crear y "Mis combos" (una tarjeta por combo).
    return (data || []).filter((d) => d.tipo === 'crear' || esMiCombo(d));
  },
});


const TusCreaciones = ({ uid }) => {
  const creacionesQuery = useCreacionesCrear(uid);
  const borradoresQuery = useBorradoresCrear(uid);
  const creaciones = useMemo(() => creacionesQuery.data || [], [creacionesQuery.data]);
  const borradores = useMemo(() => borradoresQuery.data || [], [borradoresQuery.data]);
  // Versiones anteriores de las prendas de los combos: aquí no salen (las
  // oculta agruparCombos); esto solo las marca y borra las que pasaron los días.
  useVersionesReemplazadas({
    uid,
    creaciones,
    borradores,
    listo: creacionesQuery.isSuccess && !creacionesQuery.isFetching
      && borradoresQuery.isSuccess && !borradoresQuery.isFetching,
  });
  const { pedir: pedirEliminar, dialogo: dialogoEliminar } = useEliminarCreacion();
  // Las mismas tarjetas que Mis creaciones, la más reciente primero.
  const tarjetas = useMemo(
    () => agruparCombos(creaciones, borradores).sort((a, b) => (fechaDeCreacion(b) || 0) - (fechaDeCreacion(a) || 0)),
    [creaciones, borradores]
  );
  const recientes = tarjetas.slice(0, 8);
  // Eliminar un combo se lleva sus prendas (useEliminarMiCombo refresca las listas).
  const quitarCombo = useEliminarMiCombo();
  if (!creaciones.length) return dialogoEliminar;
  return (
    <section className={styles.seccion} aria-label="Tus creaciones">
      <div className={styles.seccionCabecera}>
        <div>
          <h2 className={styles.seccionTitulo}><T>Tus creaciones</T></h2>
          <p className={styles.seccionAyuda}><T>Listas para comprar o seguir editando.</T></p>
        </div>
        <Link to="/cuenta/creaciones" className={styles.verTodas}>
          <T>Ver todas</T>{tarjetas.length > 1 ? ` (${tarjetas.length})` : ''} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <FilaCarrusel>
        {recientes.map((c) => (esMiCombo(c)
          ? <TarjetaMiCombo key={c.id} design={c} onEliminar={quitarCombo} />
          : <MiCreacionCard key={c.id} design={c} onEliminar={pedirEliminar} />))}
      </FilaCarrusel>
      {dialogoEliminar}
    </section>
  );
};

/**
 * Diseños de la comunidad (los publica Walá): para empezar desde uno ya
 * hecho en vez de desde cero. Se ven también sin iniciar sesión.
 */
const DisenosComunidad = () => {
  const { data: disenos = [] } = useComunidad();
  if (!disenos.length) return null;
  return (
    <section className={styles.seccion} aria-label="Diseños de la comunidad">
      <div className={styles.seccionCabecera}>
        <div>
          <h2 className={styles.seccionTitulo}><T>Diseños de la comunidad</T></h2>
          <p className={styles.seccionAyuda}><T>Elige uno y hazlo tuyo.</T></p>
        </div>
        <Link to="/comunidad" className={styles.verTodas}>
          <T>Ver todos</T>{disenos.length > 1 ? ` (${disenos.length})` : ''} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <FilaCarrusel>
        {disenos.slice(0, 8).map((d) => <TarjetaComunidad key={d.id} diseno={d} />)}
      </FilaCarrusel>
    </section>
  );
};

const PersonalizarViejo = () => {
  // El admin ve también los borradores, para revisarlos antes de publicarlos.
  const { isAdmin, user } = useAuth();
  const { data: creaciones = [] } = useCreacionesCrear(user?.uid);
  const { data: borradores = [] } = useBorradoresCrear(user?.uid);
  const { data: comunidad = [] } = useComunidad();
  const { data: prendas = [], isLoading } = useQuery({
    queryKey: ['prendas-base', Boolean(isAdmin)],
    queryFn: async () => {
      const { data, error } = await getPrendasBase({ incluirBorradores: Boolean(isAdmin) });
      if (error) throw new Error(error);
      return data;
    },
  });

  const { data: combos = [] } = useQuery({
    queryKey: ['combos-crear', Boolean(isAdmin)],
    queryFn: async () => (await getCombosCrear({ incluirBorradores: Boolean(isAdmin) })).data,
  });
  // Solo los combos cuyas prendas están a la venta (o en borrador, para el admin).
  const prendaPorId = useMemo(() => new Map(prendas.map((p) => [p.id, p])), [prendas]);
  const combosListos = combos
    .map((c) => ({ combo: c, prendas: c.piezas.map((p) => prendaPorId.get(p.prendaId)) }))
    .filter(({ prendas: ps }) => ps.every(Boolean));

  // "¿Para cuántos?": 1 son las prendas sueltas; 2, 3… los combos con esas
  // piezas. Va en la dirección (?para=2) para que al volver siga elegido.
  const [params, setParams] = useSearchParams();
  const opcionesPara = [1, ...[...new Set(combosListos.map(({ combo }) => combo.piezas.length))].sort((a, b) => a - b)];
  const para = opcionesPara.includes(Number(params.get('para'))) ? Number(params.get('para')) : 1;
  const elegirPara = (n) => {
    const siguiente = new URLSearchParams(params);
    if (n === 1) siguiente.delete('para'); else siguiente.set('para', String(n));
    setParams(siguiente, { replace: true });
  };
  const combosDePara = combosListos.filter(({ combo }) => combo.piezas.length === para);
  const soloConjuntos = (n) => {
    const deN = combosListos.filter(({ combo }) => combo.piezas.length === n);
    return deN.length > 0 && deN.every(({ combo }) => esConjunto(combo));
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        {/* Kapi diseñando, de fondo. En escritorio el banner ancho (texto en
            el lado libre, a la derecha); en el celular uno vertical (texto
            arriba, Kapi abajo). Es decoración: no se arrastra ni se elige. */}
        <picture>
          <source media="(max-width: 768px)" srcSet="/crear/banner-crear-movil.webp" width="800" height="1067" />
          <img
            className={styles.heroArte}
            src="/crear/banner-crear.webp"
            srcSet="/crear/banner-crear-1200.webp 1200w, /crear/banner-crear.webp 2172w"
            sizes="1136px"
            alt=""
            aria-hidden="true"
            draggable={false}
            width="2172"
            height="724"
          />
        </picture>
        <div className={styles.heroTexto}>
          <h1 className={styles.title}><T>Crea tu prenda</T></h1>
          <p className={styles.subtitle}>
            <T>Elige una prenda, ponle tu imagen o tu frase y la imprimimos para ti.</T>
          </p>
          <ol className={styles.pasos}>
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className={styles.paso}>
                <span className={styles.pasoIcono}><Icono size={20} aria-hidden="true" /></span>
                <span className={styles.pasoTexto}>
                  <strong>{i + 1}. <T>{titulo}</T></strong>
                  <span><T>{texto}</T></span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {user && <TusBorradores uid={user.uid} />}
      {user && <TusCreaciones uid={user.uid} />}
      <DisenosComunidad />
      {(creaciones.length > 0 || borradores.length > 0 || comunidad.length > 0 || opcionesPara.length > 1) && (
        <div className={styles.seccionCabecera}>
          <div>
            <h2 className={styles.seccionTitulo}><T>Empieza una nueva</T></h2>
            <p className={styles.seccionAyuda}>
              {para === 1
                ? <T>Elige la prenda que quieres diseñar.</T>
                : <T>Cada prenda con su propio diseño, color y talla, a precio de combo.</T>}
            </p>
          </div>
        </div>
      )}

      {opcionesPara.length > 1 && (
        <div className={styles.selectorPara} role="radiogroup" aria-label="¿Para cuántas personas?">
          {opcionesPara.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={para === n}
              className={`${styles.opcionPara} ${para === n ? styles.opcionParaActiva : ''}`}
              onClick={() => elegirPara(n)}
            >
              {n === 1 || soloConjuntos(n) ? <User size={17} aria-hidden="true" /> : <Users size={17} aria-hidden="true" />}
              <T>{etiquetaPara(n, soloConjuntos(n))}</T>
              {n > 1 && <span className={styles.ahorraPara}><T>Ahorras</T></span>}
            </button>
          ))}
        </div>
      )}

      {para > 1 ? (
        <div className={styles.grilla}>
          {combosDePara.map(({ combo, prendas: ps }) => <TarjetaCombo key={combo.id} combo={combo} prendas={ps} />)}
        </div>
      ) : isLoading ? (
        <div className={styles.grilla}>
          {[0, 1, 2].map((i) => <div key={i} className={styles.esqueleto} />)}
        </div>
      ) : prendas.length > 0 ? (
        <div className={styles.grilla}>
          {prendas.map((p) => <TarjetaPrenda key={p.id} prenda={p} />)}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Shirt size={48} aria-hidden="true" /></div>
          <h2><T>Muy pronto</T></h2>
          <p><T>Estamos preparando las prendas que podrás diseñar. Mientras tanto, mira lo que tenemos en la tienda.</T></p>
          <Link to="/tienda" className={styles.botonTienda}><T>Ir a la tienda</T></Link>
        </div>
      )}
    </div>
  );
};

export default PersonalizarViejo;
