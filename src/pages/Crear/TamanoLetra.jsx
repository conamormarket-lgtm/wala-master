import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { UNIDADES_ZONA } from '../../utils/prendaBase';
import styles from './TamanoLetra.module.css';

/**
 * Tamaño de la letra de un texto, en cm de la prenda (alto de la letra) si
 * la zona tiene medida real; si no, en puntos de la zona. Se cambia con − / +
 * o escribiendo el número. El texto se achica solo si no entra en su zona
 * (editarCapa), así que un número muy grande queda en lo que entra.
 *
 * Con `imagen`, el ancho de una imagen: en cm de la prenda, o en % del ancho
 * de la zona si no tiene medida (como el tamaño de la imagen en el kit).
 *
 *   <TamanoLetra capa={capa} cmPorUnidad={n} onCambiar={(escala) => …} />
 *   <TamanoLetra imagen capa={capa} cmPorUnidad={n} onCambiar={(escala) => …} />
 */
const TamanoLetra = ({ capa, cmPorUnidad = 0, onCambiar, imagen = false }) => {
  const enCm = cmPorUnidad > 0;
  const base = imagen ? capa.anchoNatural || 1 : capa.tamano || 90;
  const escala = Math.abs((imagen ? capa.escalaX : capa.escalaY) || 1);
  // Lo que se muestra: cm con un decimal, o puntos enteros (o % de la zona, una imagen).
  const enUnidad = (unidades) => (enCm ? Math.round(unidades * cmPorUnidad * 10) / 10 : imagen ? Math.round((unidades / UNIDADES_ZONA) * 100) : Math.round(unidades));
  const aUnidades = (v) => (enCm ? v / cmPorUnidad : imagen ? (v / 100) * UNIDADES_ZONA : v);
  const valor = enUnidad(base * escala);
  const paso = enCm ? (imagen ? 1 : 0.5) : 5;
  const minimo = enCm ? (imagen ? 1 : 0.3) : 5;
  const sufijo = enCm ? 'cm' : imagen ? '%' : 'pt';
  const nombre = imagen ? 'Ancho de la imagen' : 'Tamaño de letra';
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => { setTexto(String(valor)); }, [valor]);

  const fijar = (nuevo) => {
    if (!Number.isFinite(nuevo)) {
      setTexto(String(valor));
      return;
    }
    const limpio = Math.max(minimo, nuevo);
    onCambiar(aUnidades(limpio) / base);
  };
  const confirmar = () => fijar(Number(String(texto).replace(',', '.')));
  // Con − / + se va al siguiente múltiplo del paso (4.3 → 4.5 → 5).
  const subir = () => fijar((Math.floor(valor / paso + 1e-6) + 1) * paso);
  const bajar = () => fijar((Math.ceil(valor / paso - 1e-6) - 1) * paso);

  return (
    <div className={styles.tamano} role="group" aria-label={nombre}>
      <button type="button" className={styles.boton} onClick={bajar} disabled={valor <= minimo} aria-label={imagen ? 'Más chica' : 'Letra más chica'}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <label className={styles.campo}>
        <input
          type="text"
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmar();
              e.currentTarget.blur();
            }
          }}
          aria-label={imagen ? `${nombre}${enCm ? ' en centímetros' : ' en % de la zona'}` : enCm ? 'Alto de la letra en centímetros' : 'Tamaño de la letra'}
        />
        <span>{sufijo}</span>
      </label>
      <button type="button" className={styles.boton} onClick={subir} aria-label={imagen ? 'Más grande' : 'Letra más grande'}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default TamanoLetra;
