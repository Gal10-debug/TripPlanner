# Server setup

Run from the repository root with `dotnet run --project server`.

## Password reset email

The custom `/api/auth/forgot-password` endpoint durably queues an email containing
an ASP.NET Identity reset code. HTTP 200 means the request was accepted or
suppressed by the cooldown; it does not mean SMTP delivery completed. Users can paste it into the reset form immediately,
or return later through **Forgot your password? → I already have a reset code**.
Successful reset invalidates the code. Tokens expire after one hour.

Configure these environment variables in the server's deployment secrets/settings:

| Variable | Value |
| --- | --- |
| `Email__Smtp__Host` | Your SMTP provider's hostname |
| `Email__Smtp__Port` | `587` for STARTTLS (default), or your provider's port |
| `Email__Smtp__FromAddress` | A sender address verified by your provider |
| `Email__Smtp__FromName` | Optional display name; defaults to `TripPlanner` |
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
Queue persistence failures also return HTTP 503. Registered and unknown addresses,
and requests suppressed by cooldown, receive identical successful public responses.
The Identity `/api/auth/forgotPassword` alias redirects with HTTP 307 to this same
queue; it cannot bypass cooldown or use a separate email delivery path.

Recovery endpoints (both hyphenated and Identity aliases) share a limit of 10
requests per remote IP per 15 minutes, plus 100 requests per minute across the
instance. HTTP 429 includes `Retry-After` and a generic message. Forwarded IP
headers are not trusted automatically: when deploying behind a reverse proxy,
configure ASP.NET forwarded headers with explicit trusted proxies before rate
limiting, or clients will share the proxy's limit. Edge-level limits are still
needed for distributed denial-of-service protection. These in-memory limits are
per process; the deployment remains a single API instance.

Each normalized email address has a durable five-minute cooldown, including unknown
addresses. Concurrent requests share one database row, and pending work is not
replaced by repeated requests. Addresses are keyed by SHA-256 of the Identity
normalized email; this is an identifier, not encryption. The actual recipient,
user identity, security stamp, and reset token are protected together with ASP.NET
Data Protection. No plaintext reset tokens or addresses are stored in this queue.
The worker runs every 15 seconds, processes up to 20 due jobs per pass, and uses a
two-minute database lease with a 20-second SMTP timeout. It makes at most five
attempts with delays of 1, 2, 4, and 8 minutes between failures. Attempt counters
are saved before sending. Requests expire one hour after creation; tokens are not
regenerated on retry. Password or account-email changes cancel pending deliveries.

`PasswordResetDeliveries` tracks `pending`, `sent`, `failed`, `expired`, and
`cancelled`, attempt counts, next-attempt time, SMTP acceptance time, and only the
exception type on failure. Status is internal: there is no public endpoint that
could expose account existence. Monitor status counts and the `Password reset
delivery failed` / `Password reset queue check failed` logs. Investigate terminal
failures; the user can request another code after cooldown. Protected payloads are
erased when work reaches a terminal status; all queue records are pruned after
24 hours. SMTP acceptance is not inbox delivery. A crash after SMTP accepts a
message but before the status update can cause a duplicate; retries resend the
same code and do not extend its lifetime.

The additive `AddPasswordResetQueue` migration runs at startup. Persist the SQLite
database **and the ASP.NET Data Protection key ring** across deployments: both
pending email decryption and reset-token validation depend on these keys. Use
`ASPNETCORE_ENVIRONMENT=Production` in deployment. Development retains the local
token response for newly accepted requests and queues email when configured.
`PasswordReset:DisableWorker` is intended for tests only. Keep the API running to
process the queue; this change does not introduce a separate worker service.

These changes implement delivery but do not configure a live provider. Verify a
reset email reaches a controlled inbox after deployment settings are supplied.
No real emails are sent by the automated tests.

## Tests

From the repository root: `dotnet test TripPlanner.slnx`.

Password-reset integration tests use temporary SQLite databases, ephemeral
Data Protection keys, and a recording email sender. They cover the production
request/reset/login flow, token reuse and expiry, weak passwords, unknown users,
missing SMTP configuration, delivery failures/retries, concurrent requests,
cooldowns, IP/global limits, alias routes, application restarts, persistence failures,
terminal cleanup, and the development shortcut.

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

The client polls every minute, so a new reminder can take up to two polling intervals to display. Browser alerts use an opt-in account preference and use a service worker, Web Locks, and local storage to suppress repeat alerts in the same browser. They require HTTPS (or localhost), browser support and granted permission, and an open app. Serve `/notifications-sw.js` as JavaScript from the frontend origin. Clearing site storage resets browser suppression. Closed-app web push is not implemented. Opt-in email reminder delivery is described below.

Tests disable the hosted worker with `Notifications:DisableWorker=true` and exercise generation directly with a fixed clock.

## Notification preferences and email delivery

`GET /api/notifications/preferences` returns the authenticated account's `emailReminders`, `browserNotifications`, and server `emailAvailable` capability. `PUT` accepts the two boolean preferences. Both default to false, including migrated accounts. Profile updates preserve these preferences. The Notifications page saves them; Settings links to that page. Browser permission remains device-specific and is requested only after a user action.

Email reminders reuse the `Email:Smtp` configuration documented above and require TLS. Opt-in is rejected with 503 when SMTP configuration is absent/invalid. No existing notification is replayed when email is enabled: only notification records first created while opted in are queued. Messages include destination, reminder title and due date, with English/Hebrew wording; they do not include booking references or notes.

The hosted worker processes up to 50 queued emails per check. A durable two-minute lease prevents simultaneous claims; failures retry after 2, 4, 8, 16, 32, 60, and 60 minutes, stopping after eight failed attempts. The notification center shows queued, sent, or failed status. Opt-out cancels pending messages; delivery also rechecks trip membership, completion, rescheduling, and trip end dates. An already in-flight SMTP send cannot be recalled. Missing SMTP configuration pauses queued delivery. Restart the API to apply `AddNotificationPreferences` and enable the new endpoint/services.

SMTP delivery cannot guarantee exactly once: a process failure after SMTP acceptance but before recording success may result in a repeat after the lease expires. A failed SMTP disconnect after acceptance is not treated as delivery failure. A sent status means the SMTP server accepted the message, not that it reached the inbox.

Tests replace both email interfaces with recording fakes and never send real email. Live SMTP delivery and native browser alerts remain unverified. This SQLite setup continues to assume one API instance for default-reminder generation.


## Patched dependencies

The server explicitly pins `Microsoft.OpenApi` 2.7.5 for
[GHSA-v5pm-xwqc-g5wc](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc), and
`SQLitePCLRaw.bundle_e_sqlite3` 3.0.5, which replaces the vulnerable native
`SQLitePCLRaw.lib.e_sqlite3` 2.1.11 dependency with `SQLite` 3.53.4 for
[GHSA-2m69-gcr7-jv3q](https://github.com/advisories/GHSA-2m69-gcr7-jv3q).
The framework packages currently select the older transitive versions without
these overrides. Check both projects with:

```sh
dotnet list TripPlanner.slnx package --vulnerable --include-transitive
```

The restore and vulnerability audit on 2026-09-28 reported no known vulnerable
packages in either project. Re-run before releases; an audit is a point-in-time
check, not a guarantee against unknown vulnerabilities. Native SQLite integration
is tested on the current host; run the same tests on the deployment OS.
