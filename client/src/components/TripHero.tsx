import { useState } from 'react';
import type { Trip } from '../models/Trip';
import { getPreferences, t } from '../i18n/preferences';
import { resolveCountry } from '../data/countries';
import countryPhotos from '../data/countryPhotos.json';
import { getTripStatus } from '../utils/tripStatus';
import './TripHero.css';

interface CountryPhoto {
    url: string;
    source: string;
    artist: string;
    license: string;
    licenseUrl: string;
}

export default function TripHero({ trip }: { trip: Trip }) {
    const code = resolveCountry(trip.country)?.code;
    const photo = code ? (countryPhotos as Record<string, CountryPhoto>)[code] : undefined;
    // Reset image loading/failure state whenever the saved country changes.
    return <DestinationHero key={code ?? trip.country} trip={trip} photo={photo} />;
}

function DestinationHero({ trip, photo }: { trip: Trip; photo?: CountryPhoto }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const date = (value: string) => new Intl.DateTimeFormat(getPreferences().language, {
        day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));

    return <header className={`trip-hero${loaded && !failed ? ' trip-hero--loaded' : ''}`}>
        {photo && !failed && <img className="trip-hero__photo" src={photo.url} alt="" referrerPolicy="no-referrer" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
        <div className="trip-hero__shade" aria-hidden="true" />
        <div className="trip-hero__content">
            <span className="trip-hero__country"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>{trip.country}</span>
            <h1>{trip.destination}</h1>
            <div className="trip-hero__meta"><span><time dateTime={trip.startDate}>{date(trip.startDate)}</time> — <time dateTime={trip.endDate}>{date(trip.endDate)}</time></span><span>{trip.days} {t('days')}</span><span className="trip-hero__status">{t(getTripStatus(trip))}</span></div>
        </div>
        {photo && loaded && !failed && <details className="trip-hero__credit"><summary>{t('Photo credits')}</summary><div><a href={photo.source} target="_blank" rel="noreferrer">{photo.artist}</a><span>{photo.license} · {t('Cropped to fit')}</span><a href={photo.source} target="_blank" rel="noreferrer">Wikimedia Commons ↗</a>{photo.licenseUrl && <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{t('Image license')} ↗</a>}</div></details>}
    </header>;
}
