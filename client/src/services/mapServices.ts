export interface MapLocation {
  id: number;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export async function findMapLocations(query: string, language: string, signal: AbortSignal): Promise<MapLocation[]> {
  const params = new URLSearchParams({ name: query, count: '10', language, format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Unable to load the map. Please try again.');
  const data = await response.json();
  if (data.error || (data.results !== undefined && !Array.isArray(data.results))) throw new Error('Invalid map response');
  return (data.results ?? []).filter((item: MapLocation) => item && Number.isInteger(item.id) && typeof item.name === 'string' &&
    Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 85 && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180);
}
