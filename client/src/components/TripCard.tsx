import { t, getPreferences } from "../i18n/preferences";
import { Link, useLocation } from "react-router-dom";
import type { Trip } from "../models/Trip";
import type { TripStatus } from "../utils/tripStatus";

function TripCard({ trip, status }: { trip: Trip; status: TripStatus }) {
    const location = useLocation();
    return <article className="trip-card">
        <Link className="trip-card__summary" to={`/trips/${trip.id}`} state={{ tripsSearch: location.search }} aria-label={t("View trip to {destination}, {country}", { destination: trip.destination, country: trip.country })}>
            <span className="trip-card__place"><small>{trip.country}</small><strong>{trip.destination}</strong><span className="trip-card__badges"><span className={`trip-status trip-status--${status}`}>{t(status)}</span>{trip.accessRole !== "Owner" && <span className="access-badge">{t("Shared ·")}{" "}{t(trip.accessRole)}</span>}</span></span>
            <span className="trip-card__dates">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}<small>{trip.days}{" "}{t("days")}</small></span>
            <span className="expand-icon" aria-hidden="true">→</span>
        </Link>
    </article>;
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat(getPreferences().language, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default TripCard;
