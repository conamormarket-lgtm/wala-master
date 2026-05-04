import { formatCurrency, formatDate } from './helpers';

export { formatCurrency, formatDate };

/**
 * Formatea el nombre del producto para URL
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

/**
 * Trunca texto con ellipsis
 */
export const truncate = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
