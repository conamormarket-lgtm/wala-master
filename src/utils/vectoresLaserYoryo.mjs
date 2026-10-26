// Originales de Laser proporcionados por la marca. Las rutas tienen versión
// para que los borradores y pedidos mantengan el escudo que eligió el cliente.
export const ESCUDOS_LASER_YORYO = {
  'Alianza Lima': { url: '/yoryo/laser/alianza-lima-v1.svg', viewBox: [0, 0, 1049.47, 1333.33] },
  Universitario: { url: '/yoryo/laser/universitario-v1.svg', viewBox: [0, 0, 221.25, 221.25] },
  'Sporting Cristal': { url: '/yoryo/laser/sporting-cristal-v1.svg', viewBox: [61.84, 18.3, 126.05, 212.6] },
  'Sport Boys': { url: '/yoryo/laser/sport-boys-v1.svg', viewBox: [0, 0, 300, 300] },
  Barcelona: { url: '/yoryo/laser/barcelona-v1.svg', viewBox: [28.79, 24.98, 1195.46, 1211.01] },
  'Real Madrid': { url: '/yoryo/laser/real-madrid-v1.svg', viewBox: [221.1, 130, 408.2, 578.3] },
};

export function vectorLaserDeEquipo(equipo, config) {
  if (config?.tecnica !== 'laser') return null;
  return config.produccion?.vectoresPorEquipo?.[equipo] || ESCUDOS_LASER_YORYO[equipo] || null;
}
