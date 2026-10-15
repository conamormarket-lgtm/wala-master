import { useHeatmapTracker } from '../../hooks/useHeatmapTracker';

// El mapa de calor en su propio archivo: App lo monta con lazy(), así sus
// ~12 KB no viajan en el arranque y empieza a registrar un instante después.
export default function RastreoCalor({ enabled, batchSize }) {
  useHeatmapTracker(enabled, batchSize);
  return null;
}
