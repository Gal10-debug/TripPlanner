# TripPlanner

Trip planning with shared trips, itineraries, budgets, reminders, English/Hebrew and account privacy controls. React/TypeScript frontend, ASP.NET Core 10 API, and SQLite. The supported production topology is one API instance behind Caddy with automatic HTTPS.

## Local development

Install Node.js 24 and .NET SDK 10. Run `npm ci` in `client`, then run `dotnet run --project server` and `npm --prefix client run dev` in separate terminals. See [server setup](server/README.md) for SMTP configuration. Never use Development mode on a public server.

## Verification

```sh
npm --prefix client ci
npm --prefix client test
npm --prefix client run build
npm --prefix client run lint
dotnet test TripPlanner.slnx
python3 scripts/audit_nuget.py
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Browser tests require Chromium: from `client`, run `npx playwright install --with-deps chromium`, then `npm run test:e2e`. They publish and launch an isolated server with a temporary database; they never use the development database or send real emails. Desktop and mobile projects cover direct routes, sharing, RTL, print controls/export, and browser notification permissions. Native print dialogs, OS notification delivery, and closed-app push are outside that coverage.

## Production and delivery

See the [deployment runbook](deploy/README.md) for provisioning, GitHub configuration, secrets, restore drills, monitoring and the launch checklist. CI runs frontend/backend checks, dependency audits, backup tests and browser tests before building an image. Successful main builds publish an immutable GHCR image; production deployment is a separate manual workflow using a protected GitHub environment.

The container serves the frontend and API on one origin, including refreshes of `/trips` and other frontend routes. SQLite and Data Protection keys persist outside the container. Backups use SQLite's online backup API and include the keys needed for sessions and queued recovery messages.

`/budgets` consolidates accessible trips by currency without currency conversion. Settings provides password-confirmed account JSON export and permanent deletion. Shared trips owned by other accounts are preserved; deleting an owner removes their trips for collaborators too. Deleted information can remain in retained backups until expiry.

Google Calendar sync, closed-app Web Push and multiple API instances remain future work. See [TASKS.md](TASKS.md).
