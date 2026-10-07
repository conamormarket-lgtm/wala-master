import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shirt, Upload, ShoppingBag, ArrowRight, Paintbrush } from 'lucide-react';
import { getPrendasBase } from '../services/prendasBase';
import { getDesignsByUser } from '../services/designs';
import { useAuth } from '../contexts/AuthContext';
import { leerPrendaBase, precioBase, colorDisponible } from '../utils/prendaBase';
import { useEliminarCreacion } from './Crear/useEliminarCreacion';
import TusBorradores, { useBorradoresCrear } from './Crear/TusBorradores';
import FilaCarrusel from './Crear/FilaCarrusel';
import MiCreacionCard, { fechaDeCreacion } from './cuenta/components/MiCreacionCard';
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
  return (
    <Link to={`/crear/${prenda.id}`} className={styles.tarjeta}>
      <div className={styles.foto}>
        {prenda.visible === false && <span className={styles.borrador}>Borrador</span>}
        {frente && <img src={frente} alt={prenda.name} className={styles.fotoFrente} loading="lazy" />}
        {espalda && <img src={espalda} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
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
              style={{ background: c.hex2 ? `linear-gradient(135deg, ${c.hex} 50%, ${c.hex2} 50%)` : c.hex }}
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
    return (data || []).filter((d) => d.tipo === 'crear');
  },
});

const TusCreaciones = ({ uid }) => {
  const { data: creaciones = [] } = useCreacionesCrear(uid);
  const { pedir: pedirEliminar, dialogo: dialogoEliminar } = useEliminarCreacion();
  // Las mismas tarjetas que Mis creaciones, la más reciente primero.
  const recientes = useMemo(
    () => [...creaciones].sort((a, b) => (fechaDeCreacion(b) || 0) - (fechaDeCreacion(a) || 0)).slice(0, 8),
    [creaciones]
  );
  if (!creaciones.length) return dialogoEliminar;
  return (
    <section className={styles.seccion} aria-label="Tus creaciones">
      <div className={styles.seccionCabecera}>
        <div>
          <h2 className={styles.seccionTitulo}><T>Tus creaciones</T></h2>
          <p className={styles.seccionAyuda}><T>Listas para comprar o seguir editando.</T></p>
        </div>
        <Link to="/cuenta/creaciones" className={styles.verTodas}>
          <T>Ver todas</T>{creaciones.length > 1 ? ` (${creaciones.length})` : ''} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <FilaCarrusel>
        {recientes.map((c) => (
          <MiCreacionCard key={c.id} design={c} onEliminar={pedirEliminar} />
        ))}
      </FilaCarrusel>
      {dialogoEliminar}
    </section>
  );
};

const PersonalizarPage = () => {
  // El admin ve también los borradores, para revisarlos antes de publicarlos.
  const { isAdmin, user } = useAuth();
  const { data: creaciones = [] } = useCreacionesCrear(user?.uid);
  const { data: borradores = [] } = useBorradoresCrear(user?.uid);
  const { data: prendas = [], isLoading } = useQuery({
    queryKey: ['prendas-base', Boolean(isAdmin)],
    queryFn: async () => {
      const { data, error } = await getPrendasBase({ incluirBorradores: Boolean(isAdmin) });
      if (error) throw new Error(error);
      return data;
    },
  });

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
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

      {user && <TusBorradores uid={user.uid} />}
      {user && <TusCreaciones uid={user.uid} />}
      {(creaciones.length > 0 || borradores.length > 0) && (
        <div className={styles.seccionCabecera}>
          <div>
            <h2 className={styles.seccionTitulo}><T>Empieza una nueva</T></h2>
            <p className={styles.seccionAyuda}><T>Elige la prenda que quieres diseñar.</T></p>
          </div>
        </div>
      )}

      {isLoading ? (
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

export default PersonalizarPage;
