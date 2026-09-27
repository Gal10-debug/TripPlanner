# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Application routes

The application uses React Router with browser history. Signed-in routes currently
include `/dashboard`, `/trips`, `/trips/:tripId`, `/calendar`, `/invitations`, and `/settings`.
Each trip has a dedicated page with details, itinerary, packing, budget, weather,
and sharing. Trip cards link to that page; browser Back returns to the previous
page, and the All trips link provides a return path for direct visits. `/` redirects to the dashboard.
Authentication preserves the requested URL.

For production, configure the frontend host to return `index.html` for frontend
routes, preserving static assets and `/api/*` requests. Otherwise, refreshing or
opening a page URL directly may return a server 404. Vite handles this in development.

Run routing regression tests with `npm test`.


## Monthly calendar

`/calendar` combines owned and shared trips and itinerary activities. Use the month
picker, previous/next buttons, or Today to navigate. Select a date to see all trips
and activities for that day, including destinations and activity locations. Agenda
links open the relevant trip page. Mobile uses compact day counts with the full
agenda below the calendar.

The URL records the month and selected date, for example
`/calendar?month=2026-09&day=2026-09-27`, so browser Back restores the same view.
Date-only values remain on their saved calendar day; activity times are displayed
as entered in the itinerary, without conversion between destination time zones.
The server supplies the month through `GET /api/calendar?month=YYYY-MM`.


## Trip search and sorting

On `/trips`, search by destination or country and choose All, Current, Upcoming,
or Completed. Matching ignores case and accents; multiple search words can span
the destination and country. Status counts reflect the current search.

Sort by travel start date, trip length, or date added, in either direction.
Search, status, and sort are stored in URL parameters, for example
`/trips?status=all&q=Italy&sort=duration-desc`. Refresh, browser Back, and the
trip page's All trips link preserve these choices. Adding a trip clears the search
and selects its status so it is visible.

New trips have server-recorded creation timestamps. Older trips have no recorded
creation date; their original creation sequence is used for date-added sorting,
before timestamped trips in oldest-first order (and after them in newest-first).


## Account preferences and Hebrew

`/settings` saves a display name, language (English or Hebrew), time zone, and
default currency to the signed-in account. Email is shown read-only. Preferences
are loaded at sign-in; saving applies them immediately, and logout resets the
in-memory settings to prevent one account's preferences appearing in another.
Defaults for accounts without saved settings are English, UTC, and USD.

Hebrew switches the document to `lang="he"` and `dir="rtl"`, mirrors navigation
and reading alignment, and localizes main interface labels and date/currency
formatting. Email addresses, URLs, dates, and numeric controls remain LTR where
appropriate. User-entered destinations, notes, and other trip content are not
translated. Detailed validation messages supplied by the server can remain in
English when no translation is defined. No browser was available for visual RTL
QA; automated tests cover language/direction changes and localized flows.

The selected time zone determines today, trip status, new expense dates, and
reminder day calculations. Date-only trip/activity values and entered activity
times remain unchanged. A default currency applies to newly created trips only;
changing it does not convert existing budgets or expenses.

Translations live in `src/i18n/he.ts`; `src/i18n/preferences.ts` holds the reactive
in-memory preferences and formatting helpers. `App` subscribes to preference
changes to re-render the interface. Missing translations fall back to English.

## Destination maps

Trip details include an on-demand destination map. The browser queries [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) using destination, country and interface language, then embeds [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Export). Multiple matches require a selection; the selection is local to the current page. Attribution links identify OpenStreetMap, Open-Meteo and GeoNames.

Destination, accommodation and itinerary links use [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) with encoded search/directions parameters. Only place text is included, never booking references or notes. Directions let Google Maps determine the origin. Accommodation and activity locations open externally rather than appearing as additional pins on the destination map.

The current public geocoding endpoint needs no key; review Open-Meteo's usage terms before commercial deployment. A production content-security policy must allow connections to `https://geocoding-api.open-meteo.com` and frames from `https://www.openstreetmap.org`. Map rendering requires internet access; external map links remain available after lookup failures. No backend or schema changes are needed.
