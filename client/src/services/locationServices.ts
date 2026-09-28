export interface CitySuggestion { id: string; name: string; region: string; countryCode: string }
const cache = new Map<string, CitySuggestion[]>();
export async function searchCities(query: string, countryCode: string, language: string, signal: AbortSignal): Promise<CitySuggestion[]> {
  const key = JSON.stringify([query.trim(), countryCode, language]);
  const cached = cache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ name: query.trim(), countryCode, language, count: '20', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('City lookup failed');
  const data = await response.json();
  if (!data || data.error || (data.results !== undefined && !Array.isArray(data.results))) throw new Error('Invalid city lookup');
  const seen = new Set<number>();
  const results: CitySuggestion[] = (data.results ?? []).flatMap((item: { id?: number; name?: string; admin1?: string; country_code?: string; feature_code?: string } | null) => {
    if (!item || typeof item.id !== 'number' || !Number.isInteger(item.id) || typeof item.name !== 'string' || !item.name.trim() ||
      item.country_code?.toUpperCase() !== countryCode.toUpperCase() || !item.feature_code?.startsWith('PPL') || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{ id: String(item.id), name: item.name, region: typeof item.admin1 === 'string' ? item.admin1 : '', countryCode }];
  });
  if (!signal.aborted) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, results);
  }
  return results;
}
