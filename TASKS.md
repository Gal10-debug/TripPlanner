# Next development steps

Work incrementally on local feature branches. Do not push or merge without a request.

1. Routing and navigation — implemented on `feature/navigation-routing`.
   - Dashboard, Trips, Invitations; desktop sidebar and mobile bottom navigation.
   - Root redirect, unknown route recovery, authenticated page access.
   - Five routing tests, production build, and lint pass.
   - Visual browser verification remains pending because no browser was available.
2. Dedicated `/trips/:id` page — implemented on `feature/trip-details-page` (based on step 1).
   - Compact list cards link to the trip page; all existing panels and permissions are preserved.
   - Direct URLs, history Back, All trips link, loading, retry, and unavailable-trip states.
   - Editing updates the page and list; successful deletion returns to the list, failures stay visible.
   - Routing and page regression tests cover navigation, edits, deletion, and Viewer/Editor controls.
   - Visual browser verification remains pending because no browser was available.
3. Reminder and password-reset fixes — implemented on `fix/reminders-password-reset` (based on step 2).
   - Reminders distinguish loading, empty results, and errors; deleting the last reminder shows the empty state.
   - Departure alerts show loading and failures with a retry action.
   - SMTP password-reset email delivery and a complete emailed-code entry flow, including return visits.
   - Production token privacy, one-hour expiry, configuration checks, and generic account responses.
   - 28 frontend tests, frontend build/lint, and 10 server integration tests pass.
   - Deployment still needs SMTP credentials and a verified sender; see `server/README.md`. Live email delivery has not been verified.
   - Existing NuGet audit warnings remain for Microsoft.OpenApi 2.0.0 and SQLitePCLRaw.lib.e_sqlite3 2.1.11; dependency remediation is separate from these fixes.
4. Monthly calendar — implemented on `feature/monthly-calendar` (based on step 3).
   - `/calendar` navigation on desktop and mobile; month/year navigation, month picker, Today, and a selected-day agenda.
   - Owned/shared trip spans and itinerary activities use one access-controlled monthly endpoint.
   - Month and selected day stay in the URL, preserving context when returning from trip links.
   - Date-only handling, leap years, cross-month/year spans, loading, retry, empty states, and obsolete-request cancellation.
   - 40 frontend tests, frontend build/lint, and 23 backend integration tests pass.
   - Browser visual verification remains pending because no browser is available.
5. Trip search and sorting — implemented on `feature/trip-search-sort` (based on step 4).
   - Destination/country search ignores case and accents and supports multiple words.
   - All/current/upcoming/completed filters show matching counts; six sort choices cover travel date, duration, and date added in either direction.
   - URL parameters preserve filters on refresh and browser Back; the All trips link and delete return also preserve the list context.
   - Server-recorded creation dates for new trips; existing trips retain null dates and use their original ID sequence for date-added ordering.
   - Additive nullable-column migration preserves existing trip data; timestamps cannot be changed through trip create/edit requests.
   - 55 frontend tests and 25 server tests pass, along with frontend build/lint.
   - Local API restarted with the updated migration. Browser visual verification remains pending.
6. Account settings and preferences — implemented on `feature/account-preferences` (based on step 5).
   - `/settings` saves display name, English/Hebrew, time zone, and default currency per authenticated account; account email is displayed read-only.
   - Preferences load at sign-in, persist across sessions, and reset in memory at logout.
   - Hebrew labels across the main screens, document language/direction, RTL layout, and localized date/currency formatting. User-entered content stays unchanged; detailed server validation messages can fall back to English.
   - Preferred time zone drives today, trip status, expense default date, and reminder day calculations. Trip calendar dates and itinerary clock times are not converted.
   - Currency preference initializes new trip budgets; existing budgets and expenses retain their currency.
   - 66 frontend tests and 32 backend tests, build, and lint pass. Account isolation, persistence, validation, RTL switching, and currency preservation are covered.
   - AddAccountSettings migration adds a separate per-user table. Local API restarted after the migration; visual RTL verification remains pending because no browser is connected.
7. Notification center and due-reminder delivery — implemented on `feature/notifications` (based on step 6).
   - `/notifications` with a header unread count, trip links, individual/all read controls, loading, empty, and retry states; English/Hebrew labels.
   - A background check every minute creates persistent notifications for incomplete due reminders on active owned/shared trips, using each recipient’s time zone.
   - Unique database keys prevent repeated delivery records. Completed/rescheduled reminders and revoked trip access are filtered from the center.
   - Optional browser alerts enabled explicitly for the current session, with service-worker click-through and cross-tab duplicate prevention. Requires browser support, HTTPS/localhost, and an open app; this is not closed-app push.
   - Email reminders and persistent account-wide channel preferences remain the later channel expansion; existing SMTP remains for password reset only.
   - 71 frontend tests and 34 backend tests, build, and lint pass. Local API restarted; migration, authenticated endpoint protection, and service-worker asset verified. Browser visual/native notification verification remains pending because no browser is connected.
8. Destination maps and directions — implemented on `feature/destination-maps` (based on step 7).
   - Each trip has an expandable OpenStreetMap destination map, with Open-Meteo/GeoNames location lookup and a chooser for ambiguous results.
   - Google Maps search and directions for destinations, saved accommodation names/addresses, and itinerary activities with locations. Available to shared-trip viewers as well as editors.
   - Encoded place queries, labeled responsive map, English/Hebrew controls, loading, timeout/retry, no-match guidance, and external links when embedding is unavailable.
   - Changes to destination/country reset the map; obsolete lookups are canceled. Booking references and notes are excluded from map requests.
   - 78 frontend tests, build, and lint pass. Live public destination lookup verified. Visual map verification remains pending because no browser is connected.
   - No new dependency, API key, or database migration. Activity/accommodation links open external searches; their pins are not overlaid on the embedded destination map.
9. Trip export and print with addresses, bookings, activities, and packing list.
10. Extend critical-flow tests for trip creation/editing, sharing, expenses, and password reset as the relevant work lands.

Add a Budget navigation entry when its cross-trip page is functional.

## Deployment requirement

The frontend host must serve `client/dist/index.html` for non-file frontend paths such as `/trips` and `/invitations`, while preserving `/api/*` routing. Vite provides this fallback during development. The repository currently has no production frontend hosting configuration; configure the rewrite on the chosen host before deploying clean URLs.

## Verification

Run from `client`: `npm test`, `npm run build`, `npm run lint`.
Run from the repository root: `dotnet test TripPlanner.slnx`.
