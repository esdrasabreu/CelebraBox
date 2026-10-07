export interface LocationSearchResult {
  id: string;
  title: string;
  subtitle: string;
  raw?: unknown;
}

export interface EventLocationData {
  // Provider-independent model
  name: string;
  formattedAddress: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  providerPlaceId?: string;
  mapsUrl: string;

  // Backward compatibility aliases with legacy codebase
  address: string;
  mapsLink: string;
}

export interface LocationProvider {
  id: string;
  name: string;
  search(query: string): Promise<LocationSearchResult[]>;
  getDetails(result: LocationSearchResult): Promise<EventLocationData>;
  geocode?(address: string): Promise<EventLocationData | null>;
  generateMapsUrl(location: Partial<EventLocationData>): string;
}
