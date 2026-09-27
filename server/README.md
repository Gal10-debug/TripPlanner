# Server setup

Run from the repository root with `dotnet run --project server`.

## Password reset email

The custom `/api/auth/forgot-password` endpoint now sends an email containing an
ASP.NET Identity reset code. Users can paste it into the reset form immediately,
or return later through **Forgot your password? → I already have a reset code**.
Successful reset invalidates the code. Tokens expire after one hour.

Configure these environment variables in the server's deployment secrets/settings:

| Variable | Value |
| --- | --- |
| `Email__Smtp__Host` | Your SMTP provider's hostname |
| `Email__Smtp__Port` | `587` for STARTTLS (default), or your provider's port |
| `Email__Smtp__FromAddress` | A sender address verified by your provider |
| `Email__Smtp__FromName` | Optional display name; defaults to `Wanderly` |
| `Email__Smtp__Username` | SMTP username |
| `Email__Smtp__Password` | SMTP password or provider SMTP key |
| `Email__Smtp__UseImplicitTls` | `false` for required STARTTLS (default); `true` for implicit TLS, normally port 465 |

Username and password must either both be present or both be omitted for a relay
that authorizes the server by other means. TLS is always required and certificate
validation remains enabled. Sending has a 20-second deadline. Keep credentials out
of source control. SMTP providers that require OAuth instead of SMTP credentials
need a different authentication adapter.

In Production (and any non-Development environment), the endpoint never returns
the token. Without valid SMTP settings it returns HTTP 503 for every account.
A runtime delivery failure is logged by exception type only; the public response
stays generic to avoid revealing registered accounts. Monitor the server's
`Password reset email delivery failed` errors; failed sends are not queued or
automatically retried. Users can request another code.

Development retains the existing token-in-response shortcut, and also sends email
if SMTP is configured. Use `ASPNETCORE_ENVIRONMENT=Production` in deployment.
Persist and protect the ASP.NET Data Protection key ring in production, and share
it between replicas, so reset codes remain valid across restarts and servers.
The one-hour token lifetime also applies to other Identity data-protection tokens.

These changes implement delivery but do not configure a live provider. Verify a
reset email reaches a controlled inbox after deployment settings are supplied.
No real emails are sent by the automated tests.

## Tests

From the repository root: `dotnet test TripPlanner.slnx`.

Password-reset integration tests use temporary SQLite databases, ephemeral
Data Protection keys, and a recording email sender. They cover the production
request/reset/login flow, token reuse and expiry, weak passwords, unknown users,
missing SMTP configuration, delivery failures, and the development shortcut.

Frontend regression checks: `npm --prefix client test`,
`npm --prefix client run build`, and `npm --prefix client run lint`.


## Monthly calendar API

`GET /api/calendar?month=YYYY-MM` requires authentication and returns `trips` and
`activities` arrays. Trips overlap the requested month inclusively; activities
are restricted to dates in that month, sorted by date and time. Both queries
include only trips owned by the current user or shared with them. Viewer and
Editor memberships may both read the calendar; revoked memberships stop appearing
on the next request. Invalid or missing months return HTTP 400.

Calendar integration tests cover access control, revoked sharing, month boundaries,
cross-year trips, leap days, invalid parameters, and empty months.


## Trip creation dates

The `AddTripCreatedAt` migration adds a nullable `CreatedAt` column. Existing rows
stay null, preserving their data without fabricating creation timestamps. New
trips receive `DateTimeOffset.UtcNow` on the server and return `createdAt` in trip
API responses. The create/edit request DTOs do not accept creation timestamps;
edits leave the original value unchanged. The migration runs at API startup,
consistent with the existing migration workflow. Restart the server after updating.


## Account settings

`GET /api/settings`, `PUT /api/settings`, and `GET /api/settings/options` require
authentication. Settings are keyed by the caller's Identity user ID; request fields
cannot change the account email or select another user. Updates validate a display
name of at most 100 characters, `en`/`he`, supported time zone IDs, and the supported
currencies USD/EUR/GBP/ILS/JPY/CAD/AUD. The options endpoint supplies the currency
and host-supported time zone lists. Defaults are English, UTC, and USD.

`AddAccountSettings` adds a separate settings table with a cascading foreign key
to Identity users. Existing trips, budgets, and accounts are preserved. New trip
budgets use the creator's current default currency; previous trips do not change.
The dashboard reminders endpoint uses the caller's time zone for its date window.
Restart the API to apply the migration and register the new controller.

## Reminder notifications

The API runs a notification check at startup and every minute. Keep the API running to deliver reminders while users are away. Due dates use the recipient's saved time zone (UTC by default); overdue incomplete reminders are included until the trip ends. Owned and shared trips are supported. The additive `AddNotifications` migration runs at startup.

`GET /api/notifications`, `PUT /api/notifications/{id}/read`, and `PUT /api/notifications/read-all` require authentication and current trip access. Completing or rescheduling a reminder removes its old notification from the visible center. Read status is per account. Database uniqueness makes recurring notification inserts idempotent; default reminder generation is serialized within a single API process. This SQLite deployment expects one API instance.

The client polls every minute, so a new reminder can take up to two polling intervals to display. Browser alerts are opt-in per session and use a service worker, Web Locks, and local storage to suppress repeat alerts in the same browser. They require HTTPS (or localhost), browser support and granted permission, and an open app. Serve `/notifications-sw.js` as JavaScript from the frontend origin. Clearing site storage resets browser suppression. No web-push subscription or email reminder delivery is implemented in this phase; SMTP remains dedicated to password reset.

Tests disable the hosted worker with `Notifications:DisableWorker=true` and exercise generation directly with a fixed clock.
