import React, { createContext, useContext, useState } from 'react';

const LayoutContext = createContext();

export const useLayoutContext = () => useContext(LayoutContext);

export const LayoutProvider = ({ children }) => {
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const [isFooterVisible, setFooterVisible] = useState(true);
  // La página termina con un Kapi (la tarjeta de ayuda de Preguntas
  // frecuentes): el pie no asoma otro (un solo Kapi a la vista).
  const [pieSinKapi, setPieSinKapi] = useState(false);
  // La página trae su propio Kapi a la vista (la tarjeta de "No encontramos
  // esta página"): el de la esquina no flota.
  const [kapiFlotanteOculto, setKapiFlotanteOculto] = useState(false);

  return (
    <LayoutContext.Provider value={{
      isHeaderVisible,
      setHeaderVisible,
      isFooterVisible,
      setFooterVisible,
      pieSinKapi,
      setPieSinKapi,
      kapiFlotanteOculto,
      setKapiFlotanteOculto,
    }}>
      {children}
    </LayoutContext.Provider>
  );
};
