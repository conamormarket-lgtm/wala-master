import React, { createContext, useContext, useMemo } from 'react';
// Directo del archivo (no de kit/index.js): el índice arrastraría el CSS de
// todo el kit al paquete principal.
import { ProveedorToasts, useToast as useToastKit } from '../componentes/kit/Feedback';

const ToastContext = createContext();

export const useGlobalToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useGlobalToast debe usarse dentro de un ToastProvider');
    }
    return context;
};

const TIPOS = { success: 'exito', error: 'error', warning: 'aviso', info: 'info' };

// Los toasts del kit no llevan emojis (cada celular los dibuja distinto):
// se quitan los que algunos mensajes traen al inicio ("✅ Tu pedido…").
const sinEmojiInicial = (texto) =>
    typeof texto === 'string' ? texto.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '') : texto;

/**
 * Puente: la tienda sigue llamando addToast/success/error… como siempre, pero
 * lo que se ve son los toasts del kit (apilados, sobre la barra inferior, con
 * modo noche).
 */
const PuenteToasts = ({ children }) => {
    const mostrar = useToastKit();

    const valor = useMemo(() => {
        const addToast = (message, type = 'info', duration = 4000) => {
            mostrar({ titulo: sinEmojiInicial(message), tipo: TIPOS[type] || 'info', duracion: duration });
        };
        return {
            toasts: [],
            addToast,
            removeToast: () => {},
            success: (message, duration) => addToast(message, 'success', duration),
            error: (message, duration) => addToast(message, 'error', duration),
            warning: (message, duration) => addToast(message, 'warning', duration),
            info: (message, duration) => addToast(message, 'info', duration),
        };
    }, [mostrar]);

    return <ToastContext.Provider value={valor}>{children}</ToastContext.Provider>;
};

export const ToastProvider = ({ children }) => (
    <ProveedorToasts>
        <PuenteToasts>{children}</PuenteToasts>
    </ProveedorToasts>
);
