import NotificationsPage, { NotificationProvider, NotificationLink } from "./components/Notifications";
import { t, defaultPreferences, setPreferences, todayKey, usePreferences } from "./i18n/preferences";
import { getSettings } from "./services/settingsServices";
import SettingsPage from "./pages/SettingsPage";
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
import TripCard from "./components/TripCard";
import NavIcon from "./components/NavIcon";


import "./App.css";
import "./design.css";

function App() {
  const preferences = usePreferences();
  const [settingsError, setSettingsError] = useState("");
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [tripsError, setTripsError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");

  const today = todayKey();
  const tripsByStatus = useMemo(() => ({
    current: sortTripsByStatus(trips, "current", today),
    upcoming: sortTripsByStatus(trips, "upcoming", today),
    completed: sortTripsByStatus(trips, "completed", today)
  }), [trips, today]);

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
    getSettings().then(settings => { if (!cancelled) setPreferences(settings); })
      .catch(() => { if (!cancelled) setSettingsError("Unable to load preferences. Open Settings to retry."); })
      .finally(() => { if (!cancelled) setIsLoadingPreferences(false); });
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
      setPreferences(defaultPreferences);
      setIsLoadingPreferences(true);
      setSettingsError("");
      setError("");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Failed to log out.");
    }
  }

  if (isCheckingSession || (user && isLoadingPreferences)) {
    return <main className="loading-screen"><div className="brand-mark" aria-hidden="true">✦</div><p>{t("Preparing your next adventure…")}</p></main>;
  }

  if (!user) {
    return (
      <main className="welcome-page">
        <section className="welcome-hero">
          <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><span>{t("TripPlanner")}</span></div>
          <div className="hero-copy">
            <span className="eyebrow">{t("Your journey starts here")}</span>
            <h1>{t("Dream it.")}<br /><em>{t("Plan it.")}</em>{" "}{t("Go.")}</h1>
            <p>{t("Keep every destination, date, and detail together—so you can spend less time organizing and more time exploring.")}</p>
          </div>
          <div className="destination-card" aria-hidden="true">
            <div className="destination-card__image"><span className="sun" /><span className="mountain mountain--back" /><span className="mountain mountain--front" /></div>
            <div className="destination-card__content"><div><span>{t("Featured escape")}</span><strong>{t("Amalfi Coast, Italy")}</strong></div><span className="destination-arrow">↗</span></div>
          </div>
          <p className="hero-note">{t("Plan simply. Travel beautifully.")}</p>
        </section>
        <section className="welcome-panel">
          <div className="auth-shell">
            <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">✦</span><span>{t("TripPlanner")}</span></div>
            {error && <p className="alert" role="alert">{t(error)}</p>}
            <AuthForm onAuthenticated={setUser} />
          </div>
          <p className="auth-footer">{t("Adventure is waiting.")}</p>
        </section>
      </main>
    );
  }

  return (
    <NotificationProvider key={user.email}><div className="dashboard app-layout">
      <a className="skip-link" href="#page-content">{t("Skip to content")}</a>
      <header className="dashboard-header">
        <Link to="/dashboard" className="brand brand--dark"><span className="brand-mark" aria-hidden="true">✦</span><span>{t("TripPlanner")}</span></Link>
        <div className="account-actions"><NotificationLink /><span>{preferences.displayName || user.email}</span><button className="button button--ghost" onClick={handleLogout}>{t("Log out")}</button></div>
      </header>
      <nav className="app-navigation" aria-label={t("Main navigation")}>
        <NavLink to="/dashboard"><NavIcon name="dashboard" /><span>{t("Dashboard")}</span></NavLink>
        <NavLink to="/trips"><NavIcon name="trips" /><span>{t("Trips")}</span></NavLink>
        <NavLink to="/calendar"><NavIcon name="calendar" /><span>{t("Calendar")}</span></NavLink>
        <NavLink to="/invitations"><NavIcon name="invitations" /><span>{t("Invitations")}</span></NavLink>
        <NavLink to="/settings"><NavIcon name="settings" /><span>{t("Settings")}</span></NavLink>
      </nav>
      <main id="page-content" className="dashboard-content" tabIndex={-1}>
        {error && <p className="alert" role="alert">{t(error)}</p>}
        {settingsError && <p role="alert">{t(settingsError)} <Link to="/settings" onClick={() => setSettingsError("")}>{t("Settings")}</Link></p>}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<>
            <section className="dashboard-hero">
              <div className="dashboard-hero__copy">
                <PageHeading title={t("Where to next?")} description={t("Your journeys at a glance.")} />
                <p className="dashboard-hero__description">{t("A little planning. A world of possibilities.")}</p>
                <Link className="button button--accent" to="/trips"><span aria-hidden="true">＋</span>{t("Plan your next trip")}</Link>
              </div>
              <div className="journey-art" aria-hidden="true">
                <span className="journey-art__sun" /><span className="journey-art__ridge journey-art__ridge--back" /><span className="journey-art__ridge journey-art__ridge--front" />
                <span className="journey-art__trail" /><span className="journey-art__compass">✦</span>
                <span className="journey-art__caption">WANDER MORE</span>
              </div>
            </section>
            <DepartureAlerts />
            {tripsError && <div role="alert"><p>{tripsError}</p><button className="button" onClick={refreshTrips}>{t("Retry loading trips")}</button></div>}
            <div className="journey-overview" aria-busy={isLoadingTrips}>
              {(["current", "upcoming", "completed"] as TripStatus[]).map((status, index) => <Link key={status} className={`journey-stat journey-stat--${status}`} to={`/trips?status=${status}`}><span className="journey-stat__label"><span className={`status-dot status-dot--${status}`} />{t(status)}{" "}{t("trips")}</span>{" "}<strong>{isLoadingTrips || tripsError ? "—" : tripsByStatus[status].length}</strong>{" "}<span className="journey-stat__footer">{t(["Enjoy the moment", "Something to look forward to", "Memories made"][index])}<span aria-hidden="true">↗</span></span></Link>)}
            </div>
            <section className="dashboard-journeys" aria-labelledby="journeys-heading">
              <div className="section-heading"><h2 id="journeys-heading">{t("On the horizon")}</h2><Link className="text-link" to="/trips?status=all">{t("View all trips")} <span aria-hidden="true">↗</span></Link></div>
              {isLoadingTrips ? <p role="status">{t("Loading trips…")}</p> : !tripsError && (
                tripsByStatus.current.length + tripsByStatus.upcoming.length > 0
                  ? <div className="trip-grid">{[...tripsByStatus.current, ...tripsByStatus.upcoming].slice(0, 3).map(trip => <TripCard key={trip.id} trip={trip} status={tripsByStatus.current.includes(trip) ? "current" : "upcoming"} />)}</div>
                  : <div className="empty-state dashboard-empty"><span aria-hidden="true">✦</span><h3>{t("Your map is wide open")}</h3><p>{t("Add your next trip and start counting down the days.")}</p><Link className="text-link" to="/trips">{t("Create a trip")} <span aria-hidden="true">↗</span></Link></div>
              )}
            </section>
          </>} />
          <Route path="/trips" element={<TripsPage trips={trips} isLoading={isLoadingTrips} error={tripsError} onRetry={refreshTrips} onTripAdded={trip => setTrips(currentTrips => [...currentTrips, trip])} />} />
          <Route path="/trips/:tripId" element={<TripPage trips={trips} isLoading={isLoadingTrips} loadError={tripsError} onRetry={refreshTrips} onDelete={handleDeleteTrip} onUpdate={handleUpdateTrip} onUpdateDetails={handleUpdateDetails} />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/invitations" element={<>
            <PageHeading title={t("Invitations")} description={t("Manage invitations to journeys with friends and family.")} />
            <InvitationsPanel onAccepted={refreshTrips} />
          </>} />
          <Route path="*" element={<><PageHeading title={t("Page not found")} description={t("This address does not match a page.")} /><Link to="/dashboard">{t("Return to dashboard")}</Link></>} />
        </Routes>
      </main>
    </div></NotificationProvider>
  );
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="dashboard-intro"><span className="eyebrow">{t("My journeys")}</span><h1>{t(title)}</h1><p>{t(description)}</p></div>;
}

export default App;
