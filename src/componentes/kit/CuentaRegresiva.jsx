import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import s from './CuentaRegresiva.module.css';

/**
 * Cuenta regresiva (antes había 2: FlashSales y ConversionFold).
 *
 *  - hasta: fecha ISO de fin (ofertas con fecha fija).
 *  - horas + clave: "siempre activa": cada visitante tiene su propio plazo
 *    de N horas guardado en localStorage con esa clave (landings).
 *  - textoFin: lo que se muestra al terminar. onTerminar: aviso.
 *  - variante: 'bloques' (cajitas HH MM SS) | 'texto' (02:14:09) |
 *    'evento' (dígitos grandes con la letra del logo y rótulos; para fondos
 *    oscuros como el de las ofertas relámpago).
 */
export default function CuentaRegresiva({ hasta, horas, clave = 'wala_oferta_fin', textoFin = '¡Terminó!', onTerminar, variante = 'bloques', etiqueta = 'Termina en' }) {
  const [fin] = useState(() => calcularFin({ hasta, horas, clave }));
  const [restante, setRestante] = useState(() => Math.max(0, fin - Date.now()));

  useEffect(() => {
    if (restante <= 0) return undefined;
    const id = window.setInterval(() => {
      const r = Math.max(0, fin - Date.now());
      setRestante(r);
      if (r === 0) { window.clearInterval(id); onTerminar?.(); }
    }, 1000);
    return () => window.clearInterval(id);
  }, [fin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fin) return null;
  if (restante <= 0) return <span className={s.fin}>{textoFin}</span>;

  const total = Math.floor(restante / 1000);
  const partes = [
    ['h', Math.floor(total / 3600)],
    ['m', Math.floor((total % 3600) / 60)],
    ['s', total % 60],
  ];
  const dos = (n) => String(n).padStart(2, '0');

  if (variante === 'evento') {
    const nombres = { h: 'horas', m: 'min', s: 'seg' };
    return (
      <div className={s.evento} role="timer" aria-label={`${etiqueta} ${partes[0][1]} horas ${partes[1][1]} minutos`}>
        {partes.map(([u, n], i) => (
          <React.Fragment key={u}>
            {i > 0 && <span className={s.eventoDosPuntos} aria-hidden="true">:</span>}
            <span className={[s.eventoCaja, u === 's' && s.eventoSegundos].filter(Boolean).join(' ')}>
              <span className={s.eventoNumero}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.strong
                    key={n}
                    initial={{ y: '-60%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '60%', opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {dos(n)}
                  </motion.strong>
                </AnimatePresence>
              </span>
              <small>{nombres[u]}</small>
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (variante === 'texto') {
    return (
      <span className={s.texto} role="timer" aria-label={`${etiqueta} ${partes.map(([u, n]) => `${n}${u}`).join(' ')}`}>
        {partes.map(([, n]) => dos(n)).join(':')}
      </span>
    );
  }

  return (
    <div className={s.bloques} role="timer" aria-label={`${etiqueta} ${partes[0][1]} horas ${partes[1][1]} minutos`}>
      {etiqueta && <span className={s.etiqueta}>{etiqueta}</span>}
      {partes.map(([u, n], i) => (
        <React.Fragment key={u}>
          {i > 0 && <span className={s.separador} aria-hidden="true">:</span>}
          <span className={s.bloque}>
            <strong>{dos(n)}</strong>
            <small>{u}</small>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function calcularFin({ hasta, horas, clave }) {
  if (hasta) {
    const t = new Date(hasta).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (!horas) return 0;
  try {
    const guardado = Number(localStorage.getItem(clave));
    if (guardado && guardado > Date.now()) return guardado;
    const nuevo = Date.now() + horas * 3600 * 1000;
    localStorage.setItem(clave, String(nuevo));
    return nuevo;
  } catch (e) {
    return Date.now() + horas * 3600 * 1000;
  }
}
