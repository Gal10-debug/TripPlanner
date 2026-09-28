import TripHero from "../components/TripHero";
import TripExport from "../components/TripExport";
import { t } from "../i18n/preferences";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Trip, TripDetailsRequest } from "../models/Trip";
import { getTripStatus } from "../utils/tripStatus";
import TripDetails from "../components/TripDetails";

interface TripPageProps {
    trips: Trip[];
    isLoading: boolean;
    loadError: string;
    onRetry: () => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    onUpdate: (trip: Trip) => Promise<void>;
    onUpdateDetails: (id: number, details: TripDetailsRequest) => Promise<void>;
}

export default function TripPage({ trips, isLoading, loadError, onRetry, onDelete, onUpdate, onUpdateDetails }: TripPageProps) {
    const { tripId = "" } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const savedSearch = (location.state as { tripsSearch?: unknown } | null)?.tripsSearch;
    const returnPath = `/trips${typeof savedSearch === "string" && savedSearch.startsWith("?") ? savedSearch : ""}`;
    const trip = /^[1-9]\d*$/.test(tripId) ? trips.find(item => item.id === Number(tripId)) : undefined;

    async function deleteAndReturn(id: number) {
        await onDelete(id);
        navigate(returnPath, { replace: true });
    }

    return <section className="trip-page">
        <Link className="trip-back-link" to={returnPath}>{t("← All trips")}</Link>
        {isLoading ? <p role="status">{t("Loading trip…")}</p> : loadError ? <div role="alert"><p>{t(loadError)}</p><button className="button" onClick={onRetry}>{t("Retry loading trips")}</button></div> : !trip ?
            <div className="empty-state"><h1>{t("Trip not found")}</h1><p>{t("This trip may have been deleted or is no longer shared with you.")}</p></div> : <>
                <TripHero trip={trip} />
                <TripExport key={trip.id} tripId={trip.id} />
                <div className="trip-grid"><TripDetails key={trip.id} trip={trip} status={getTripStatus(trip)} onDelete={deleteAndReturn} onUpdate={onUpdate} onUpdateDetails={onUpdateDetails} /></div>
            </>}
    </section>;
}
