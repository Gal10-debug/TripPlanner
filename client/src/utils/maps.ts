export function placeQuery(...parts: Array<string | undefined>) {
  return parts.map(part => part?.trim()).filter(Boolean).join(', ');
}

export function mapSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`;
}

export function directionsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`;
}

export function embeddedMapUrl(latitude: number, longitude: number) {
  const bbox = [Math.max(-180, longitude - 0.06), Math.max(-85.05, latitude - 0.04), Math.min(180, longitude + 0.06), Math.min(85.05, latitude + 0.04)];
  return `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({ bbox: bbox.join(','), layer: 'mapnik', marker: `${latitude},${longitude}` })}`;
}
