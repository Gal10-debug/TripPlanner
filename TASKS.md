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
   - The originally reported OpenAPI and SQLite NuGet advisories were remediated on `fix/security-password-reset`; see the security update below.
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
   - Email reminders and persistent account-wide preferences were added in follow-up step 11 below.
   - 71 frontend tests and 34 backend tests, build, and lint pass. Local API restarted; migration, authenticated endpoint protection, and service-worker asset verified. Browser visual/native notification verification remains pending because no browser is connected.
8. Destination maps and directions — implemented on `feature/destination-maps` (based on step 7).
   - Each trip has an expandable OpenStreetMap destination map, with Open-Meteo/GeoNames location lookup and a chooser for ambiguous results.
   - Google Maps search and directions for destinations, saved accommodation names/addresses, and itinerary activities with locations. Available to shared-trip viewers as well as editors.
   - Encoded place queries, labeled responsive map, English/Hebrew controls, loading, timeout/retry, no-match guidance, and external links when embedding is unavailable.
   - Changes to destination/country reset the map; obsolete lookups are canceled. Booking references and notes are excluded from map requests.
   - 78 frontend tests, build, and lint pass. Live public destination lookup verified. Visual map verification remains pending because no browser is connected.
   - No new dependency, API key, or database migration. Activity/accommodation links open external searches; their pins are not overlaid on the embedded destination map.
9. Trip export and print — implemented on `feature/trip-export-print` (based on step 8).
   - Prepare a summary from each trip page, preview it, download standalone HTML for offline use, or print/save as PDF through the browser.
   - Fresh authenticated reads include trip dates, accommodation/address, booking reference, notes, useful links, chronological itinerary, packing quantities/status, and budget/expenses.
   - All required reads must succeed; failed or canceled preparation cannot produce a partial download. Refresh explicitly prepares a new snapshot.
   - English/Hebrew document language and direction, localized dates/currency, print margins, repeating expense table headers, and no app navigation in the printed document.
   - Escaped user content, HTTP(S)-only useful links, restrictive document CSP, and a script-disabled preview. The offline document needs no remote assets.
   - 86 frontend tests, build, and lint pass. Native print/PDF layout verification remains pending because no browser is connected. No backend or database changes.
10. Critical-flow test coverage — implemented on `test/critical-trip-flows` (based on step 9).
   - Nine new API integration cases use isolated SQLite databases and real authenticated owner, collaborator, unrelated-user, and anonymous sessions.
   - Trip creation validation, persisted details across sessions, successful edits, and rejection of date changes that would strand itinerary activities.
   - Invitation acceptance, recipient isolation, replay rejection, duplicate invite updates, decline/cancellation, editor/viewer permissions, owner-only actions, and access revocation.
   - Expense creation/edit/deletion, exact decimal totals, overspending, invalid amounts, and cross-trip expense ID isolation.
   - Existing password-reset tests cover delivery, successful reset/login, account privacy, invalid/expired codes, weak passwords, and SMTP configuration/failure behavior.
   - All 43 backend tests pass. Frontend remains at 86 passing tests from step 9. No application code, database, or deployment changes in this step.

11. Saved notification preferences and email reminders — implemented on `feature/notification-preferences` (based on step 10).
   - Persistent browser and email preferences per authenticated account, both off by default; Settings links to the notification controls.
   - Browser preferences resume on permitted devices, with an explicit permission action on new devices. Browser alerts still require an open app.
   - Opt-in reminder email reuses configured TLS SMTP; English/Hebrew messages, durable queue status, bounded retries, and claim leases. Existing notifications are not replayed on opt-in.
   - Opt-out cancels pending email; delivery checks current membership, reminder completion/date, and trip end. Queued/sent/failed status appears in the center.
   - In-app notifications remain available. SMTP acceptance cannot guarantee inbox delivery or exactly-once delivery across process failures.
   - All 89 frontend and 53 backend tests, build, and lint pass. Tests use fake email senders; no real email was sent. API restarted; migration and protected preferences endpoint verified.
   - Deployment requires SMTP configuration. Live SMTP, native browser alerts, print layout, and visual checks remain pending.

12. Country and city autocomplete — implemented on `feature/country-city-autocomplete` (based on step 11).
   - Country-first autocomplete in both new-trip and edit-trip forms, with all 249 ISO country/territory codes plus Kosovo and English/Hebrew names.
   - City suggestions are filtered by the selected country code, show region labels, and support keyboard/pointer selection. Changing country clears the city and cancels old lookups.
   - Debounced, cached, cancellable lookups with timeout/retry, empty/error messages, and manual city entry when a suggestion is missing or unavailable.
   - Create-trip submissions now show save failures, retain entered values, and disable repeated submits while saving.
   - 99 frontend tests, build, and lint pass. A live country-filtered lookup passed. Visual browser verification remains pending; no backend/schema changes.

Add a Budget navigation entry when its cross-trip page is functional.

## Deployment requirement

The frontend host must serve `client/dist/index.html` for non-file frontend paths such as `/trips` and `/invitations`, while preserving `/api/*` routing. Vite provides this fallback during development. The repository currently has no production frontend hosting configuration; configure the rewrite on the chosen host before deploying clean URLs.

## Verification

Run from `client`: `npm test`, `npm run build`, `npm run lint`.
Run from the repository root: `dotnet test TripPlanner.slnx`.


## Security update — `fix/security-password-reset`

- Pin Microsoft.OpenApi 2.7.5 and SQLitePCLRaw.bundle_e_sqlite3 3.0.5; the latter
  removes SQLitePCLRaw.lib.e_sqlite3 2.1.11 and brings in native SQLite 3.53.4.
- Recovery routes share a 10-request/IP/15-minute limit and a 100-request/minute
  instance limit, with generic 429 responses and Retry-After.
- Durable five-minute address cooldown and atomic queue deduplication, including
  the Identity forgotPassword alias. Public responses do not expose account existence.
- Encrypted recovery payloads, five bounded delivery attempts, database leases,
  terminal status tracking, expiry, and 24-hour retention. Queue persistence failures
  return 503; transient SMTP failures retry without requiring another request.
- AddPasswordResetQueue is an additive startup migration. Preserve the SQLite
  database and Data Protection key ring across deployments.
- Validation: 65 server and 113 frontend tests pass, along with frontend build/lint;
  the NuGet audit reports no vulnerable packages in either project (2026-09-28).
  Tests use recording senders; real SMTP delivery remains a deployment check.

## Follow-up integration branches

1. Google Calendar sync (`feature/google-calendar-sync`): start with explicit opt-in
   one-way export to a dedicated TripPlanner calendar. Configure a Google OAuth
   client and deployment callback URL, store refresh tokens encrypted, support
   disconnect/revocation, and persist event mappings so edits/deletes and retries
   cannot duplicate events. Confirm one-way versus two-way scope before implementation.
2. Closed-app Web Push (`feature/web-push`): configure VAPID keys, persist per-device
   subscriptions, obtain permission explicitly, deliver through a durable queue,
   and remove expired subscriptions. Verify delivery and click-through on supported
   desktop/mobile browsers without an open TripPlanner tab.
3. Multi-instance deployment (`infra/multi-instance`): evaluate PostgreSQL and a
   shared durable job queue, distributed rate limits, shared Data Protection keys,
   leader/claim coordination, idempotency, observability, and migration/backups.
   Keep the current SQLite deployment at one API instance until these are tested.
