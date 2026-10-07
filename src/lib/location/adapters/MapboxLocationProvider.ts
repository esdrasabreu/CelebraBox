import { EventLocationData, LocationProvider, LocationSearchResult } from '../types';
import { generateGoogleMapsSearchUrl } from '../ManualLocationProvider';

/**
 * Adaptador Opcional para Mapbox Geocoding API.
 * 
 * Este adaptador NÃO é obrigatório e o sistema funciona perfeitamente sem ele.
 * Se configurado no futuro, pode consumir a API usando VITE_MAPBOX_ACCESS_TOKEN.
 */
export class MapboxLocationProvider implements LocationProvider {
  id = 'mapbox';
  name = 'Mapbox Geocoding API (Opcional)';
  private accessToken: string;

  constructor(options?: { accessToken?: string }) {
    this.accessToken = options?.accessToken || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN : '') || '';
  }

  isAvailable(): boolean {
    return Boolean(this.accessToken);
  }

  async search(query: string): Promise<LocationSearchResult[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=BR&language=pt&access_token=${this.accessToken}`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();

      return (data.features || []).map((f: any) => ({
        id: f.id,
        title: f.text || f.place_name,
        subtitle: f.place_name,
        raw: f,
      }));
    } catch (err) {
      console.warn('[MapboxLocationProvider] Erro na busca:', err);
      return [];
    }
  }

  async getDetails(result: LocationSearchResult): Promise<EventLocationData> {
    const raw = result.raw as any;
    const coords = raw?.geometry?.coordinates;
    const name = result.title;
    const formattedAddress = result.subtitle || result.title;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, formattedAddress].filter(Boolean).join(', '))}`;

    return {
      name,
      formattedAddress,
      street: '',
      number: '',
      city: '',
      state: '',
      country: 'Brasil',
      latitude: coords ? coords[1] : undefined,
      longitude: coords ? coords[0] : undefined,
      provider: this.id,
      providerPlaceId: result.id,
      mapsUrl,
      address: formattedAddress,
      mapsLink: mapsUrl,
    };
  }

  generateMapsUrl(location: Partial<EventLocationData>): string {
    return generateGoogleMapsSearchUrl(location);
  }
}
