import React, { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/common/Toast/ToastContainer';

const ToastContext = createContext();

export const useGlobalToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useGlobalToast debe usarse dentro de un ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const toast = useToast();

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </ToastContext.Provider>
    );
};
