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
3. Fix reminder loading/empty state, password reset delivery in production, and departure-alert error/retry behavior.
4. Monthly calendar combining trips and itinerary activities.
5. Destination/country search and sorting by start date, duration, and creation date.
6. Settings: profile, language, timezone, default currency; Hebrew translations and RTL.
7. Notification center and due-reminder delivery; configurable notification channels.
8. Destination maps, directions, accommodation links, and activity locations.
9. Trip export and print with addresses, bookings, activities, and packing list.
10. Extend critical-flow tests for trip creation/editing, sharing, expenses, and password reset as the relevant work lands.

Add Calendar, Budget, and Settings navigation entries when their corresponding pages are functional.

## Deployment requirement

The frontend host must serve `client/dist/index.html` for non-file frontend paths such as `/trips` and `/invitations`, while preserving `/api/*` routing. Vite provides this fallback during development. The repository currently has no production frontend hosting configuration; configure the rewrite on the chosen host before deploying clean URLs.

## Verification

Run from `client`: `npm test`, `npm run build`, `npm run lint`.
