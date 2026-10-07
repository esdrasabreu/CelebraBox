import { LocationProvider } from './types';
import { ManualLocationProvider } from './ManualLocationProvider';
import { GooglePlacesLocationProvider } from './adapters/GooglePlacesLocationProvider';
import { MapboxLocationProvider } from './adapters/MapboxLocationProvider';

export * from './types';
export * from './ManualLocationProvider';
export * from './adapters/GooglePlacesLocationProvider';
export * from './adapters/MapboxLocationProvider';

/**
 * Retorna o provedor padrão de localização ativo.
 * 
 * Por padrão, utiliza o ManualLocationProvider (100% autônomo, sem chave ou faturamento).
 * Se variáveis de ambiente opcionais estiverem presentes, pode selecionar automaticamente
 * ou permitir a troca pelo desenvolvedor/anfitrião.
 */
export function getDefaultLocationProvider(): LocationProvider {
  // Verificação de adaptadores opcionais caso configurados no ambiente
  const google = new GooglePlacesLocationProvider();
  if (google.isAvailable()) {
    return google;
  }

  const mapbox = new MapboxLocationProvider();
  if (mapbox.isAvailable()) {
    return mapbox;
  }

  // Padrão: ManualLocationProvider
  return new ManualLocationProvider();
}
