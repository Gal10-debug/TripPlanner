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
include `/dashboard`, `/trips`, `/trips/:tripId`, `/calendar`, and `/invitations`.
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
