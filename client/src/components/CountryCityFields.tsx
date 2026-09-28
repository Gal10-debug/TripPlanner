import { useEffect, useState } from 'react';
import { t, usePreferences } from '../i18n/preferences';
import { findCountries, resolveCountry } from '../data/countries';
import { searchCities, type CitySuggestion } from '../services/locationServices';
import LocationAutocomplete from './LocationAutocomplete';

interface Props {
  country: string; destination: string; disabled?: boolean;
  onCountryChange: (value: string) => void; onDestinationChange: (value: string) => void;
}
export default function CountryCityFields({ country, destination, disabled, onCountryChange, onDestinationChange }: Props) {
  const { language } = usePreferences();
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; cities: CitySuggestion[]; error: boolean } | null>(null);
  const selectedCountry = resolveCountry(country);
  const code = selectedCountry?.code ?? '';
  const query = destination.trim();
  const searchKey = JSON.stringify([code, query, language, attempt]);
  const eligible = !!code && query.length >= 2 && cityOpen;
  const current = result?.key === searchKey ? result : null;
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    const controller = new AbortController();
    let timeout: number | undefined;
    const debounce = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), 8000);
      searchCities(query, code, language, controller.signal)
        .then(cities => { if (active) setResult({ key: searchKey, cities, error: false }); })
        .catch(() => { if (active) setResult({ key: searchKey, cities: [], error: true }); })
        .finally(() => window.clearTimeout(timeout));
    }, 300);
    return () => { active = false; controller.abort(); window.clearTimeout(debounce); window.clearTimeout(timeout); };
  }, [code, query, language, searchKey, eligible]);
  function changeCountry(value: string) {
    if (value !== country) { onDestinationChange(''); setCityOpen(false); }
    onCountryChange(value);
  }
  const countryOptions = findCountries(country, language);
  const cityHint = !code ? t('Choose a country first.') : query.length < 2 ? t('Type at least 2 letters to search cities.') :
    eligible && !current ? t('Searching cities…') : current?.error ? t('City suggestions are unavailable. You can enter the city manually or retry.') :
      current?.cities.length === 0 ? t('No matching cities. Try another spelling or enter the city manually.') : t('Select a suggestion or enter a city manually.');
  return <div className="country-city-fields">
    <LocationAutocomplete label={t('Country')} value={country} options={countryOptions} open={countryOpen} disabled={disabled}
      onChange={changeCountry} onSelect={option => changeCountry(option.label)} onOpen={setCountryOpen}
      hint={countryOpen && !countryOptions.length ? t('No matching country. Try its name or two-letter code.') : t('Search countries by name or code.')} />
    <LocationAutocomplete label={t('Destination')} value={destination} options={(current?.cities ?? []).map(city => ({ id: city.id, label: city.name, detail: city.region }))}
      open={cityOpen} disabled={disabled || !code} onChange={onDestinationChange} onSelect={option => onDestinationChange(option.label)} onOpen={setCityOpen} hint={cityHint} />
    {current?.error && <button type="button" className="text-action" disabled={disabled} onClick={() => { setAttempt(value => value + 1); setCityOpen(true); }}>{t('Retry city suggestions')}</button>}
    {code && <small className="location-attribution">{t('City data')}: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></small>}
  </div>;
}
