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
5. Destination/country search and sorting by start date, duration, and creation date.
6. Settings: profile, language, timezone, default currency; Hebrew translations and RTL.
7. Notification center and due-reminder delivery; configurable notification channels.
8. Destination maps, directions, accommodation links, and activity locations.
9. Trip export and print with addresses, bookings, activities, and packing list.
10. Extend critical-flow tests for trip creation/editing, sharing, expenses, and password reset as the relevant work lands.

Add Budget and Settings navigation entries when their corresponding pages are functional.

## Deployment requirement

The frontend host must serve `client/dist/index.html` for non-file frontend paths such as `/trips` and `/invitations`, while preserving `/api/*` routing. Vite provides this fallback during development. The repository currently has no production frontend hosting configuration; configure the rewrite on the chosen host before deploying clean URLs.

## Verification

Run from `client`: `npm test`, `npm run build`, `npm run lint`.
Run from the repository root: `dotnet test TripPlanner.slnx`.
