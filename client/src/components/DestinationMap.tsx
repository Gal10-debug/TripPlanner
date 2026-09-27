import { useEffect, useState } from 'react';
import type { Trip } from '../models/Trip';
import { t, usePreferences } from '../i18n/preferences';
import { findMapLocations, type MapLocation } from '../services/mapServices';
import { directionsUrl, embeddedMapUrl, mapSearchUrl, placeQuery } from '../utils/maps';

export default function DestinationMap({ trip }: { trip: Trip }) {
  const { language } = usePreferences();
  const query = placeQuery(trip.destination, trip.country);
  // Remount on saved destination/language changes so old coordinates cannot linger.
  return <MapPanel key={`${query}:${language}`} trip={trip} query={query} language={language} />;
}

function MapPanel({ trip, query, language }: { trip: Trip; query: string; language: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: boolean; locations: MapLocation[] }>({ loading: false, error: false, locations: [] });
  const [selectedId, setSelectedId] = useState('');
  const location = state.locations.find(item => String(item.id) === selectedId);
  const stay = placeQuery(trip.accommodationName, trip.accommodationAddress);
  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    findMapLocations(query, language, controller.signal).then(locations => {
      if (!active) return;
      setState({ loading: false, error: false, locations });
      setSelectedId(locations.length === 1 ? String(locations[0].id) : '');
    }).catch(() => { if (active) setState({ loading: false, error: true, locations: [] }); })
      .finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [attempt, query, language]);
  function load() {
    setSelectedId('');
    setState({ loading: true, error: false, locations: [] });
    setAttempt(current => current + 1);
  }
  return <section className="destination-map" aria-label={t('Destination map')}>
    <div className="itinerary-heading"><div><span className="eyebrow">{t('Explore your destination')}</span><h3>{t('Map and directions')}</h3></div></div>
    <p>{query}</p>
    <div className="map-links"><a href={mapSearchUrl(query)} target="_blank" rel="noreferrer">{t('Open destination in Google Maps')} ↗</a><a href={directionsUrl(query)} target="_blank" rel="noreferrer">{t('Get directions')} ↗</a></div>
    {!attempt && <button className="button button--ghost" onClick={load}>{t('Show destination map')}</button>}
    {state.loading && <p role="status">{t('Finding your destination…')}</p>}
    {state.error && <div role="alert"><p>{t('Unable to load the map. Please try again.')}</p><button className="button button--ghost" onClick={load}>{t('Retry map')}</button></div>}
    {!!attempt && !state.loading && !state.error && state.locations.length === 0 && <p>{t('No matching destination found. Use the Google Maps link or update the destination and country.')}</p>}
    {state.locations.length > 1 && <label className="map-location-picker">{t('Choose the matching destination')}<select value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">{t('Select a location')}</option>{state.locations.map(item => <option key={item.id} value={item.id}>{placeQuery(item.name, item.admin1, item.country)} ({item.latitude}, {item.longitude})</option>)}</select></label>}
    {location && <div className="destination-map__frame"><p>{placeQuery(location.name, location.admin1, location.country)}</p><iframe title={t('Destination map')} src={embeddedMapUrl(location.latitude, location.longitude)} loading="lazy" referrerPolicy="no-referrer" /><p>{t('Map not displaying? Use the Google Maps link above.')}</p></div>}
    {!!attempt && <small className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></small>}
    {stay ? <div className="map-stay"><strong>{t('Find your accommodation')}</strong><p>{stay}</p><div className="map-links"><a href={mapSearchUrl(placeQuery(stay, query))} target="_blank" rel="noreferrer">{t('View accommodation on map')} ↗</a><a href={directionsUrl(placeQuery(stay, query))} target="_blank" rel="noreferrer">{t('Directions to accommodation')} ↗</a></div></div> : <p>{t('Add an accommodation name or address in trip details to see it on a map.')}</p>}
  </section>;
}
