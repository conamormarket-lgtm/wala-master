import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * DesignClipboardContext
 *
 * A clipboard that lives OUTSIDE of individual EditorProviders so that
 * layers can be copied from one product view and pasted into another.
 * (e.g. copy text from "Frente" view and paste into "Espalda" view)
 */
const DesignClipboardContext = createContext(null);

export const useDesignClipboard = () => {
    const ctx = useContext(DesignClipboardContext);
    // Gracefully degrade if used outside provider
    if (!ctx) {
        return { globalClipboard: [], setGlobalClipboard: () => { } };
    }
    return ctx;
};

export const DesignClipboardProvider = ({ children }) => {
    const [globalClipboard, setGlobalClipboard] = useState([]);

    const copyLayers = useCallback((layers) => {
        // Deep-clone so mutations don't affect the clipboard copy
        const cloned = layers.map((l) => {
            const copy = JSON.parse(JSON.stringify(l));
            delete copy.id; // New IDs will be assigned on paste
            return copy;
        });
        setGlobalClipboard(cloned);
    }, []);

    const value = { globalClipboard, setGlobalClipboard, copyLayers };

    return (
        <DesignClipboardContext.Provider value={value}>
            {children}
        </DesignClipboardContext.Provider>
    );
};
