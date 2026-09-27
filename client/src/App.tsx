import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTrips, deleteTrip, updateTrip, updateTripDetails } from "./services/tripServices";
import type { Trip, TripDetailsRequest } from "./models/Trip";
import TripsPage from "./pages/TripsPage";
import TripPage from "./pages/TripPage";
import CalendarPage from "./pages/CalendarPage";
import AuthForm from "./components/AuthForm";
import type { User } from "./models/User";
import { getCurrentUser, logout } from "./services/authServices";
import { sortTripsByStatus, type TripStatus } from "./utils/tripStatus";
import InvitationsPanel from "./components/InvitationsPanel";
import DepartureAlerts from "./components/DepartureAlerts";


import "./App.css";

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [tripsError, setTripsError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");

  const tripsByStatus = useMemo(() => ({
    current: sortTripsByStatus(trips, "current"),
    upcoming: sortTripsByStatus(trips, "upcoming"),
    completed: sortTripsByStatus(trips, "completed")
  }), [trips]);

  const refreshTrips = useCallback(async () => {
    setIsLoadingTrips(true);
    setTripsError("");
    try {
      setTrips(await getTrips());
    } catch (loadError) {
      setTripsError(loadError instanceof Error ? loadError.message : "Failed to load trips.");
    } finally {
      setIsLoadingTrips(false);
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

    let cancelled = false;
    getTrips()
      .then(loadedTrips => { if (!cancelled) setTrips(loadedTrips); })
      .catch(loadError => { if (!cancelled) setTripsError(loadError instanceof Error ? loadError.message : "Failed to load trips."); })
      .finally(() => { if (!cancelled) setIsLoadingTrips(false); });
    return () => { cancelled = true; };
  }, [user]);

  async function handleDeleteTrip(id: number) {
    await deleteTrip(id);

    setTrips(currentTrips => currentTrips.filter(trip => trip.id !== id));
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
    try {
      await logout();
      setTrips([]);
      setIsLoadingTrips(true);
      setTripsError("");
      setUser(null);
      setError("");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Failed to log out.");
    }
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
    <div className="dashboard app-layout">
      <a className="skip-link" href="#page-content">Skip to content</a>
      <header className="dashboard-header">
        <Link to="/dashboard" className="brand brand--dark"><span className="brand-mark" aria-hidden="true">✦</span><span>Wanderly</span></Link>
        <div className="account-actions"><span>{user.email}</span><button className="button button--ghost" onClick={handleLogout}>Log out</button></div>
      </header>
      <nav className="app-navigation" aria-label="Main navigation">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/trips">Trips</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/invitations">Invitations</NavLink>
      </nav>
      <main id="page-content" className="dashboard-content" tabIndex={-1}>
        {error && <p className="alert" role="alert">{error}</p>}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<>
            <PageHeading title="Where to next?" description="Your journeys at a glance." />
            <DepartureAlerts />
            {tripsError && <div role="alert"><p>{tripsError}</p><button className="button" onClick={refreshTrips}>Retry loading trips</button></div>}
            <div className="journey-overview">
              {(["current", "upcoming", "completed"] as TripStatus[]).map(status => <Link key={status} to={`/trips?status=${status}`}><strong>{tripsByStatus[status].length}</strong><span>{status} trips</span></Link>)}
            </div>
            <Link className="button" to="/trips">Plan your next trip</Link>
          </>} />
          <Route path="/trips" element={<TripsPage trips={trips} isLoading={isLoadingTrips} error={tripsError} onRetry={refreshTrips} onTripAdded={trip => setTrips(currentTrips => [...currentTrips, trip])} />} />
          <Route path="/trips/:tripId" element={<TripPage trips={trips} isLoading={isLoadingTrips} loadError={tripsError} onRetry={refreshTrips} onDelete={handleDeleteTrip} onUpdate={handleUpdateTrip} onUpdateDetails={handleUpdateDetails} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/invitations" element={<>
            <PageHeading title="Invitations" description="Manage invitations to journeys with friends and family." />
            <InvitationsPanel onAccepted={refreshTrips} />
          </>} />
          <Route path="*" element={<><PageHeading title="Page not found" description="This address does not match a page." /><Link to="/dashboard">Return to dashboard</Link></>} />
        </Routes>
      </main>
    </div>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="dashboard-intro"><span className="eyebrow">My journeys</span><h1>{title}</h1><p>{description}</p></div>;
}

export default App;
