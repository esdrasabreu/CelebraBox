import { EventLocationData, LocationProvider, LocationSearchResult } from './types';

export function formatAddress(location: Partial<EventLocationData>): string {
  const parts: string[] = [];

  const streetNumber = [location.street, location.number].filter(Boolean).join(', ');
  if (streetNumber) parts.push(streetNumber);

  if (location.complement) parts.push(location.complement);
  if (location.neighborhood) parts.push(location.neighborhood);

  const cityState = [location.city, location.state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);

  if (location.postalCode) parts.push(`CEP ${location.postalCode}`);
  if (location.country && location.country.toLowerCase() !== 'brasil') {
    parts.push(location.country);
  }

  return parts.join(', ') || location.address || location.name || '';
}

export function generateGoogleMapsSearchUrl(location: Partial<EventLocationData>): string {
  const queryParts = [
    location.name,
    location.street ? `${location.street}${location.number ? `, ${location.number}` : ''}` : location.address,
    location.neighborhood,
    location.city,
    location.state,
    location.country || 'Brasil',
  ].filter(Boolean);

  const query = queryParts.join(', ');
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : '';
}

export class ManualLocationProvider implements LocationProvider {
  id = 'manual';
  name = 'Cadastro Manual (Padrão sem API)';

  async search(_query: string): Promise<LocationSearchResult[]> {
    // Manual provider does not depend on any external service
    return [];
  }

  async getDetails(result: LocationSearchResult): Promise<EventLocationData> {
    const mapsUrl = generateGoogleMapsSearchUrl({ name: result.title, address: result.subtitle });
    return {
      name: result.title,
      formattedAddress: result.subtitle,
      street: '',
      number: '',
      city: '',
      state: '',
      country: 'Brasil',
      mapsUrl,
      address: result.subtitle,
      mapsLink: mapsUrl,
      provider: this.id,
    };
  }

  generateMapsUrl(location: Partial<EventLocationData>): string {
    return generateGoogleMapsSearchUrl(location);
  }
}
