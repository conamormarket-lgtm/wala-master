/**
 * Formatea un número como moneda peruana
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatea una fecha
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Valida DNI peruano
 */
export const validateDNI = (dni) => {
  if (!dni) return false;
  const dniRegex = /^\d{8}$/;
  return dniRegex.test(dni);
};

/**
 * Valida Carné de Extranjería (CE): 9 a 12 caracteres alfanuméricos
 */
export const validateCE = (ce) => {
  if (!ce) return false;
  const ceRegex = /^[A-Za-z0-9]{9,12}$/;
  return ceRegex.test(ce.trim());
};

/**
 * Valida teléfono peruano
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  const phoneRegex = /^9\d{8}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

/**
 * Requisitos de contraseña para mostrar en tiempo real
 */
export const getPasswordRequirements = (password) => {
  const p = password || '';
  return {
    length: p.length >= 8,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /\d/.test(p),
    special: /[!#%&@*]/.test(p),
  };
};

export const isPasswordValid = (password) => {
  const r = getPasswordRequirements(password);
  return r.length && r.uppercase && r.lowercase && r.number && r.special;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
