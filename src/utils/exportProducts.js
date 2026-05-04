/**
 * Utilidad para exportar productos a CSV
 */

/**
 * Escapa valores para CSV
 */
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Convierte productos a formato CSV
 */
export const exportProductsToCSV = (products, categories = []) => {
  if (!products || products.length === 0) {
    return '';
  }

  const categoryName = (p) => {
    const ids = p.categories ?? (p.category ? [p.category] : []);
    if (!ids.length) return '—';
    return ids.map((id) => categories.find((c) => c.id === id)?.name || id).join(', ');
  };

  // Encabezados
  const headers = [
    'ID',
    'Nombre',
    'Categoría',
    'Precio',
    'Precio de Oferta',
    'Stock',
    'Visible',
    'Destacado',
    'Personalizable',
    'Es Ropa',
    'Descripción',
    'Imágenes',
    'Fecha de Creación'
  ];

  // Filas de datos
  const rows = products.map((p) => [
    p.id || '',
    p.name || '',
    categoryName(p),
    p.price || 0,
    p.salePrice || '',
    p.inStock || 0,
    p.visible !== false ? 'Sí' : 'No',
    p.featured ? 'Sí' : 'No',
    p.customizable ? 'Sí' : 'No',
    p.isClothing ? 'Sí' : 'No',
    (p.description || '').replace(/\n/g, ' '),
    Array.isArray(p.images) ? p.images.join('; ') : '',
    p.createdAt || ''
  ]);

  // Combinar encabezados y filas
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Descarga un archivo CSV
 */
export const downloadCSV = (csvContent, filename = 'productos.csv') => {
  const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Exporta productos seleccionados o todos los productos
 */
export const exportProducts = (products, categories = [], selectedIds = null, filename = null) => {
  const productsToExport = selectedIds && selectedIds.length > 0
    ? products.filter(p => selectedIds.includes(p.id))
    : products;

  if (productsToExport.length === 0) {
    throw new Error('No hay productos para exportar');
  }

  const csvContent = exportProductsToCSV(productsToExport, categories);
  const exportFilename = filename || `productos_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, exportFilename);
  
  return productsToExport.length;
};
