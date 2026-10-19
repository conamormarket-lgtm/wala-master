import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, ShoppingBag, Brush, Gamepad2, User } from 'lucide-react';
import { Contador } from './Etiquetas';
import { RESORTE } from './Efectos';
import { Enlace } from './Enlace';
import { Avatar } from './piezas/Avatar';
import { Texto, useTexto } from './Traduccion';
import s from './BarraInferior.module.css';

/*
 * En su propio archivo (antes en Navegacion.jsx): la tienda la monta en todas
 * las páginas y así no arrastra la cabecera (menús, buscador, avisos) al
 * archivo principal. Navegacion.jsx la sigue exportando.
 */

const TABS = [
  { id: 'inicio', texto: 'Inicio', url: '/', Icono: Home },
  { id: 'tienda', texto: 'Tienda', url: '/tienda', Icono: ShoppingBag },
  { id: 'crear', texto: 'Crear', url: '/personalizar', Icono: Brush, destacado: true },
  { id: 'juegos', texto: 'Juegos', url: '/minijuegos', Icono: Gamepad2 },
  { id: 'cuenta', texto: 'Mi cuenta', url: '/cuenta', Icono: User },
];

/**
 * Barra inferior móvil. La píldora del activo se desliza entre tabs, el
 * icono rebota al elegirlo y "Crear" va destacado al centro.
 *  - activo: id de la pestaña de la ruta actual (la tienda lo saca de la
 *    URL; null = ninguna). Sin él (undefined), la barra recuerda la última
 *    tocada (demo).
 *  - usuario: { nombre, avatar } → su foto o iniciales en "Mi cuenta"
 *  - carrito: número en "Tienda" (0 o sin pasar: nada). La tienda no lo pasa:
 *    el carrito ya tiene su número en la cabecera.
 *  - Siempre 5 pestañas con "Crear" al centro: el acceso de admin va en
 *    <BarraAdmin> (arriba), no aquí (una sexta pestaña descentraba Crear).
 *  - items: para cambiar las pestañas ({ id, texto, url, Icono, destacado })
 * Los textos pasan por la traducción (<Texto>).
 */
export function BarraInferior({ items = TABS, activo, usuario, carrito = 0, onNavegar }) {
  const uid = useId();
  const [propio, setPropio] = useState('inicio');
  const actual = activo === undefined ? propio : activo;
  const etiqueta = useTexto('Navegación principal');
  return (
    <nav className={s.barra} aria-label={etiqueta}>
      {items.map(({ id, texto, url, Icono, destacado }) => {
        const esActivo = actual === id;
        const conAvatar = id === 'cuenta' && usuario;
        return (
          <Enlace
            key={id}
            to={url}
            className={[s.tab, esActivo && s.tabActivo, destacado && s.tabDestacado].filter(Boolean).join(' ')}
            aria-current={esActivo ? 'page' : undefined}
            onClick={(e) => {
              if (activo === undefined) { e.preventDefault(); setPropio(id); }
              onNavegar?.(id);
            }}
          >
            <span className={s.tabIcono}>
              {esActivo && !destacado && (
                <motion.span layoutId={`${uid}-tab`} className={s.tabPildora} transition={RESORTE} />
              )}
              {conAvatar ? (
                <Avatar className={[s.tabAvatar, esActivo && s.rebota].filter(Boolean).join(' ')} nombre={usuario.nombre} imagen={usuario.avatar}>
                  <Icono aria-hidden="true" />
                </Avatar>
              ) : (
                <Icono key={esActivo ? 'on' : 'off'} className={esActivo ? s.rebota : undefined} aria-hidden="true" />
              )}
              {id === 'tienda' && <Contador valor={carrito} />}
            </span>
            <span className={s.tabTexto}><Texto>{texto}</Texto></span>
          </Enlace>
        );
      })}
    </nav>
  );
}

export default BarraInferior;
