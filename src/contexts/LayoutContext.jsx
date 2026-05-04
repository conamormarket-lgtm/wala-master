import React, { createContext, useContext, useState } from 'react';

const LayoutContext = createContext();

export const useLayoutContext = () => useContext(LayoutContext);

export const LayoutProvider = ({ children }) => {
  const [isHeaderVisible, setHeaderVisible] = useState(true);
  const [isFooterVisible, setFooterVisible] = useState(true);

  return (
    <LayoutContext.Provider value={{
      isHeaderVisible,
      setHeaderVisible,
      isFooterVisible,
      setFooterVisible
    }}>
      {children}
    </LayoutContext.Provider>
  );
};
