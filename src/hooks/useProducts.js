import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts, getProduct, searchProducts, getProductsByCategory } from '../services/products';

export const useProducts = (filters = [], orderBy = null) => {
  return useQuery({
    queryKey: ['products', filters, orderBy],
    queryFn: async () => {
      const { data, error } = await getProducts(filters, orderBy);
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (reduced from 1h for better freshness)
    gcTime: 1000 * 60 * 60 * 24 // 24 hours
  });
};

export const useProduct = (productId) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const { data, error } = await getProduct(productId);
      if (error) throw new Error(error);

      // Sincronizar agresivamente el producto fresco en TODAS las cachés
      // para evitar que el usuario vuelva a ver el "diseño viejo" al retroceder o recargar.
      try {
        const updater = (old) => {
          if (!Array.isArray(old)) return old;
          return old.map(p => p.id === productId ? data : p);
        };
        queryClient.setQueriesData({ queryKey: ['products'] }, updater);
        queryClient.setQueriesData({ queryKey: ['allProducts'] }, updater);
        
        try {
          const cached = localStorage.getItem('conamor_products_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            localStorage.setItem('conamor_products_cache', JSON.stringify(updater(parsed)));
          }
        } catch(e) {}
      } catch(e) {}

      return data;
    },
    initialData: () => {
      // Intenta obtener los datos iniciales de la caché general de productos 
      // (Tienda o destacados) para mostrar inmediatamente y evitar el loading.
      const queries = queryClient.getQueriesData({ queryKey: ['products'] });
      const allQueries = queryClient.getQueriesData({ queryKey: ['allProducts'] });
      
      for (const [key, data] of [...queries, ...allQueries]) {
        if (Array.isArray(data)) {
          const found = data.find(p => p.id === productId);
          if (found) return found;
        }
      }
      return undefined;
    },
    staleTime: 0, // Always fetch newest data in background
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled: !!productId
  });
};

export const useProductSearch = (searchTerm) => {
  return useQuery({
    queryKey: ['productSearch', searchTerm],
    queryFn: async () => {
      const { data, error } = await searchProducts(searchTerm);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!searchTerm && searchTerm.length > 0
  });
};

export const useProductsByCategory = (categoryId) => {
  return useQuery({
    queryKey: ['productsByCategory', categoryId],
    queryFn: async () => {
      const { data, error } = await getProductsByCategory(categoryId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!categoryId
  });
};
