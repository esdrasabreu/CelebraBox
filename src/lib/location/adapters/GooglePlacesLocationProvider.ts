import { EventLocationData, LocationProvider, LocationSearchResult } from '../types';
import { generateGoogleMapsSearchUrl } from '../ManualLocationProvider';

/**
 * Adaptador Opcional para Google Places API.
 * 
 * Este adaptador NÃO é obrigatório e o sistema funciona perfeitamente sem ele.
 * Se configurado no futuro, pode consumir a API diretamente via backend proxy
 * ou com uma chave restrita (VITE_GOOGLE_MAPS_API_KEY).
 */
export class GooglePlacesLocationProvider implements LocationProvider {
  id = 'google-places';
  name = 'Google Places API (Opcional)';
  private apiKey: string;
  private proxyUrl?: string;

  constructor(options?: { apiKey?: string; proxyUrl?: string }) {
    this.apiKey = options?.apiKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY : '') || '';
    this.proxyUrl = options?.proxyUrl;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey || this.proxyUrl);
  }

  async search(query: string): Promise<LocationSearchResult[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      if (this.proxyUrl) {
        const response = await fetch(`${this.proxyUrl}?query=${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.predictions || []).map((p: any) => ({
          id: p.place_id,
          title: p.structured_formatting?.main_text || p.description,
          subtitle: p.structured_formatting?.secondary_text || p.description,
          raw: p,
        }));
      }

      // Client-side fallback if direct endpoint is enabled
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment|geocode&language=pt-BR&key=${this.apiKey}`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.predictions || []).map((p: any) => ({
        id: p.place_id,
        title: p.structured_formatting?.main_text || p.description,
        subtitle: p.structured_formatting?.secondary_text || p.description,
        raw: p,
      }));
    } catch (err) {
      console.warn('[GooglePlacesLocationProvider] Erro na busca:', err);
      return [];
    }
  }

  async getDetails(result: LocationSearchResult): Promise<EventLocationData> {
    const raw = result.raw as any;
    const name = result.title;
    const formattedAddress = result.subtitle || result.title;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, formattedAddress].filter(Boolean).join(', '))}&query_place_id=${encodeURIComponent(result.id)}`;

    return {
      name,
      formattedAddress,
      street: '',
      number: '',
      city: '',
      state: '',
      country: 'Brasil',
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
