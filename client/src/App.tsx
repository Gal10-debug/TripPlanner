import { useCallback, useEffect, useMemo, useState } from "react";
import { getTrips, deleteTrip, updateTrip, updateTripDetails } from "./services/tripServices";
import TripForm from "./components/TripForm";
import type { Trip, TripDetailsRequest } from "./models/Trip";
import TripCard from "./components/TripCard";
import AuthForm from "./components/AuthForm";
import type { User } from "./models/User";
import { getCurrentUser, logout } from "./services/authServices";
import { getTripStatus, sortTripsByStatus, type TripStatus } from "./utils/tripStatus";
import InvitationsPanel from "./components/InvitationsPanel";


import "./App.css";

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [tripFilter, setTripFilter] = useState<TripStatus>("upcoming");

  const tripsByStatus = useMemo(() => ({
    current: sortTripsByStatus(trips, "current"),
    upcoming: sortTripsByStatus(trips, "upcoming"),
    completed: sortTripsByStatus(trips, "completed")
  }), [trips]);
  const visibleTrips = tripsByStatus[tripFilter];

  const refreshTrips = useCallback(async () => {
    try {
      setTrips(await getTrips());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load trips.");
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        setUser(await getCurrentUser());
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Failed to check your session.");
      } finally {
        setIsCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    getTrips()
      .then(setTrips)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "Failed to load trips."));
  }, [user]);

  async function handleDeleteTrip(id: number) {
    await deleteTrip(id);

    setTrips(trips.filter(trip => trip.id !== id));
  }

  async function handleUpdateTrip(updatedTrip: Trip) {
    const savedTrip = await updateTrip(updatedTrip.id, {
      destination: updatedTrip.destination,
      country: updatedTrip.country,
      startDate: updatedTrip.startDate,
      endDate: updatedTrip.endDate
    });

    setTrips(currentTrips =>
      currentTrips.map(trip => trip.id === savedTrip.id ? savedTrip : trip)
    );
  }

  async function handleUpdateDetails(id: number, details: TripDetailsRequest) {
    const savedTrip = await updateTripDetails(id, details);
    setTrips(currentTrips => currentTrips.map(trip => trip.id === id ? savedTrip : trip));
  }

  async function handleLogout() {
    await logout();
    setTrips([]);
    setUser(null);
  }

  if (isCheckingSession) {
    return <main className="loading-screen"><div className="brand-mark" aria-hidden="true">✦</div><p>Preparing your next adventure…</p></main>;
  }

  if (!user) {
    return (
      <main className="welcome-page">
        <section className="welcome-hero">
          <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><span>Wanderly</span></div>
          <div className="hero-copy">
            <span className="eyebrow">Your journey starts here</span>
            <h1>Dream it.<br /><em>Plan it.</em> Go.</h1>
            <p>Keep every destination, date, and detail together—so you can spend less time organizing and more time exploring.</p>
          </div>
          <div className="destination-card" aria-hidden="true">
            <div className="destination-card__image"><span className="sun" /><span className="mountain mountain--back" /><span className="mountain mountain--front" /></div>
            <div className="destination-card__content"><div><span>Featured escape</span><strong>Amalfi Coast, Italy</strong></div><span className="destination-arrow">↗</span></div>
          </div>
          <p className="hero-note">Plan simply. Travel beautifully.</p>
        </section>
        <section className="welcome-panel">
          <div className="auth-shell">
            <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">✦</span><span>Wanderly</span></div>
            {error && <p className="alert" role="alert">{error}</p>}
            <AuthForm onAuthenticated={setUser} />
          </div>
          <p className="auth-footer">Adventure is waiting.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="brand brand--dark"><span className="brand-mark" aria-hidden="true">✦</span><span>Wanderly</span></div>
        <div className="account-actions"><span>{user.email}</span><button className="button button--ghost" onClick={handleLogout}>Log out</button></div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-intro"><span className="eyebrow">My journeys</span><h1>Where to next?</h1><p>Turn the places on your mind into plans on your calendar.</p></div>
        {error && <p className="alert" role="alert">{error}</p>}
        <InvitationsPanel onAccepted={refreshTrips} />
        <div className="planner-layout">
          <aside className="trip-form-card"><TripForm onTripAdded={(trip) => setTrips(currentTrips => [...currentTrips, trip])} /></aside>
          <section className="trips-section">
            <div className="section-heading"><h2>Your trips</h2><span>{trips.length} {trips.length === 1 ? "journey" : "journeys"}</span></div>
            <div className="status-tabs" role="tablist" aria-label="Filter trips by status">
              {(["current", "upcoming", "completed"] as TripStatus[]).map(status => <button key={status} role="tab" aria-selected={tripFilter === status} className={tripFilter === status ? "status-tab status-tab--active" : "status-tab"} onClick={() => setTripFilter(status)}><span className={`status-dot status-dot--${status}`} />{status}<b>{tripsByStatus[status].length}</b></button>)}
            </div>
            {visibleTrips.length === 0 ? <div className="empty-state"><span aria-hidden="true">⌁</span><h3>{emptyStateCopy[tripFilter].title}</h3><p>{emptyStateCopy[tripFilter].body}</p></div> :
              <div className="trip-grid">{visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} status={getTripStatus(trip)} onDelete={handleDeleteTrip} onUpdate={handleUpdateTrip} onUpdateDetails={handleUpdateDetails} />)}</div>}
          </section>
        </div>
      </section>
    </main>
  );
}

const emptyStateCopy: Record<TripStatus, { title: string; body: string }> = {
  current: { title: "No trips underway", body: "When your travel dates arrive, your trip will appear here automatically." },
  upcoming: { title: "Your map is wide open", body: "Add your next trip and start counting down the days." },
  completed: { title: "No past journeys yet", body: "Completed trips will collect here as your travel story grows." }
};

export default App;
