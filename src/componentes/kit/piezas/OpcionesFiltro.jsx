import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Chip } from '../Etiquetas';
import s from './OpcionesFiltro.module.css';

/**
 * Las opciones de un filtro como chips (categorías, marcas, etiquetas,
 * personajes…). Una elegida a la vez: tocarla otra vez la quita. Con muchas
 * opciones muestra las primeras y "Ver N más"; la elegida siempre se ve.
 * La usan el catálogo con filtros y la búsqueda.
 *
 *  - opciones: [{ valor, nombre, cuenta? }]
 *  - elegida: valor elegido (o null)
 *  - onElegir(valor | null)
 *  - limite: cuántas se ven antes de "Ver más" (8 por defecto; 0 = todas)
 */
export function OpcionesFiltro({ opciones = [], elegida = null, onElegir, limite = 8 }) {
  const [todas, setTodas] = useState(false);
  // Solo se corta si sobran más de 2 (no vale la pena "Ver 1 más").
  const larga = limite > 0 && opciones.length > limite + 2;
  const corta = larga && !todas;
  let visibles = corta ? opciones.slice(0, limite) : opciones;
  // La elegida nunca queda escondida detrás de "Ver más".
  if (corta && elegida != null && !visibles.some((o) => o.valor === elegida)) {
    const op = opciones.find((o) => o.valor === elegida);
    if (op) visibles = [...visibles, op];
  }
  const restantes = opciones.length - visibles.length;

  return (
    <div className={s.opciones}>
      {visibles.map((o) => (
        <Chip
          key={String(o.valor)}
          tamano="sm"
          activo={elegida === o.valor}
          cuenta={o.cuenta}
          onClick={() => onElegir?.(elegida === o.valor ? null : o.valor)}
        >
          {o.nombre}
        </Chip>
      ))}
      {larga && (
        <button type="button" className={[s.mas, todas && s.menos].filter(Boolean).join(' ')} onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
          {todas ? 'Ver menos' : `Ver ${restantes} más`}
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
