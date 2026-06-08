import React, { useState } from 'react';
import { trackSearchQuery } from '../../../../services/analytics/tracker';
import { useAuth } from '../../../../contexts/AuthContext';
import styles from './ProductSearch.module.css';

const ProductSearch = ({ onSearch, placeholder = 'Buscar productos...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      trackSearchQuery(searchTerm, user).catch(console.error);
    }
    onSearch(searchTerm);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Búsqueda en tiempo real (opcional, puede ser costoso)
    // onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.searchForm}>
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder={placeholder}
        className={styles.searchInput}
      />
      <button type="submit" className={styles.searchButton}>
        🔍
      </button>
    </form>
  );
};

export default ProductSearch;
