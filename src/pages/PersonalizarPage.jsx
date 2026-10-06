import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shirt, Upload, ShoppingBag } from 'lucide-react';
import { getPrendasBase } from '../services/prendasBase';
import { leerPrendaBase, precioBase, colorDisponible } from '../utils/prendaBase';
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
  return (
    <Link to={`/crear/${prenda.id}`} className={styles.tarjeta}>
      <div className={styles.foto}>
        {frente && <img src={frente} alt={prenda.name} className={styles.fotoFrente} loading="lazy" />}
        {espalda && <img src={espalda} alt="" aria-hidden="true" className={styles.fotoEspalda} loading="lazy" />}
      </div>
      <div className={styles.info}>
        <h2 className={styles.nombre}>{prenda.name}</h2>
        <div className={styles.colores} aria-label={`${colores.length} colores`}>
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
        <div className={styles.pie}>
          <span className={styles.precio}>Desde S/ {precioBase(prenda).toFixed(2)}</span>
          <span className={styles.cta}>Diseñar</span>
        </div>
      </div>
    </Link>
  );
};

const PersonalizarPage = () => {
  const { data: prendas = [], isLoading } = useQuery({
    queryKey: ['prendas-base'],
    queryFn: async () => {
      const { data, error } = await getPrendasBase();
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
