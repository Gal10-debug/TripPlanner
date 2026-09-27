import { useSearchParams } from "react-router-dom";
import type { Trip } from "../models/Trip";
import TripForm from "../components/TripForm";
import TripCard from "../components/TripCard";
import { getTripStatus } from "../utils/tripStatus";
import { filterTrips, searchTrips, sortTrips, tripSortOptions, type TripFilter } from "../utils/tripSearch";

interface TripsPageProps {
    trips: Trip[];
    isLoading: boolean;
    error: string;
    onRetry: () => Promise<void>;
    onTripAdded: (trip: Trip) => void;
}
const filters: TripFilter[] = ["all", "current", "upcoming", "completed"];

export default function TripsPage({ trips, isLoading, error, onRetry, onTripAdded }: TripsPageProps) {
    const [params, setParams] = useSearchParams();
    const rawFilter = params.get("status");
    const filter = filters.find(value => value === rawFilter) ?? "upcoming";
    const query = params.get("q") ?? "";
    const sort = tripSortOptions.find(option => option.value === params.get("sort"))?.value ?? (filter === "completed" ? "date-desc" : "date-asc");
    const matchingTrips = searchTrips(trips, query);
    const visibleTrips = sortTrips(filterTrips(matchingTrips, filter), sort);
    const hasSearch = query.trim().length > 0;

    function updateParam(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        setParams(next, { replace: true });
    }

    return <>
        <div className="dashboard-intro"><span className="eyebrow">My journeys</span><h1>Your trips</h1><p>Turn the places on your mind into plans on your calendar.</p></div>
        <div className="planner-layout">
            <aside className="trip-form-card"><TripForm onTripAdded={trip => {
                onTripAdded(trip);
                // Make a newly created trip visible even when an old search was active.
                const next = new URLSearchParams(params);
                next.delete("q");
                next.set("status", getTripStatus(trip));
                setParams(next, { replace: true });
            }} /></aside>
            <section className="trips-section">
                <div className="section-heading"><h2>Your trips</h2><span>{trips.length} {trips.length === 1 ? "journey" : "journeys"}</span></div>
                <div className="trip-search-controls">
                    <label>Search trips<input type="search" placeholder="Destination or country" value={query} onChange={event => updateParam("q", event.target.value)} /></label>
                    <label>Sort trips<select value={sort} onChange={event => updateParam("sort", event.target.value)}>{tripSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                </div>
                <div className="status-tabs trip-status-filters" role="group" aria-label="Filter trips by status">
                    {filters.map(status => <button key={status} aria-pressed={filter === status} className={filter === status ? "status-tab status-tab--active" : "status-tab"} onClick={() => updateParam("status", status)}><span>{status}</span><b>{filterTrips(matchingTrips, status).length}</b></button>)}
                </div>
                {isLoading ? <p role="status">Loading trips…</p> : error ? <div role="alert"><p>{error}</p><button className="button" onClick={onRetry}>Retry loading trips</button></div> : <>
                    <div className="trip-search-summary"><p role="status">Showing {visibleTrips.length} of {trips.length} trips{hasSearch ? ` matching “${query.trim()}”` : ""}.</p>{query && <button className="text-action" onClick={() => updateParam("q", "")}>Clear search</button>}</div>
                    {sort.startsWith("added") && visibleTrips.some(trip => !trip.createdAt) && <p className="trip-sort-note">Older trips use their original creation order because their creation dates were not recorded.</p>}
                    {visibleTrips.length === 0 ? <div className="empty-state"><span aria-hidden="true">⌁</span><h3>{hasSearch ? "No matching trips" : emptyStateCopy[filter].title}</h3><p>{hasSearch ? "Try another destination or country, or choose a different status above." : emptyStateCopy[filter].body}</p></div> : <div className="trip-grid">{visibleTrips.map(trip => <TripCard key={trip.id} trip={trip} status={getTripStatus(trip)} />)}</div>}
                </>}
            </section>
        </div>
    </>;
}

const emptyStateCopy: Record<TripFilter, { title: string; body: string }> = {
    all: { title: "Your map is wide open", body: "Add your first trip to start planning." },
    current: { title: "No trips underway", body: "When your travel dates arrive, your trip will appear here automatically." },
    upcoming: { title: "Your map is wide open", body: "Add your next trip and start counting down the days." },
    completed: { title: "No past journeys yet", body: "Completed trips will collect here as your travel story grows." }
};
