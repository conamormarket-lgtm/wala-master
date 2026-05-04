/**
 * NavProgressBar — Barra de progreso estilo YouTube/GitHub que aparece
 * en la parte superior de la pantalla durante las transiciones de ruta.
 * Usa el evento de navegación de React Router sin dependencias externas.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './NavProgressBar.module.css';

const NavProgressBar = () => {
    const location = useLocation();
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const animRef = useRef(null);
    const prevPath = useRef(location.pathname + location.search);

    useEffect(() => {
        const currentPath = location.pathname + location.search;

        // No animar si es la misma página
        if (currentPath === prevPath.current) return;
        prevPath.current = currentPath;

        // Limpiar timers previos
        clearTimeout(timerRef.current);
        cancelAnimationFrame(animRef.current);

        // Iniciar barra
        setProgress(15);
        setVisible(true);

        // Avanzar suavemente hasta 85% (simula carga)
        let current = 15;
        const tick = () => {
            current = current < 70 ? current + 1.5 : current + 0.3;
            if (current < 85) {
                setProgress(current);
                animRef.current = requestAnimationFrame(tick);
            } else {
                setProgress(85);
            }
        };
        animRef.current = requestAnimationFrame(tick);

        // Al completar la navegación: saltar a 100% y ocultar
        timerRef.current = setTimeout(() => {
            cancelAnimationFrame(animRef.current);
            setProgress(100);
            setTimeout(() => {
                setVisible(false);
                setProgress(0);
            }, 250);
        }, 400);

        return () => {
            clearTimeout(timerRef.current);
            cancelAnimationFrame(animRef.current);
        };
    }, [location.pathname, location.search]);

    if (!visible) return null;

    return (
        <div className={styles.bar} style={{ width: `${progress}%` }} aria-hidden="true" />
    );
};

export default NavProgressBar;
