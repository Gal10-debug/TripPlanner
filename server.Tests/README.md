# Integration tests

Run from the repository root:

```sh
dotnet test TripPlanner.slnx --no-restore --verbosity minimal -m:1
```

Each `ResetApplication` factory starts the real ASP.NET Core application with an isolated temporary SQLite database and applies the actual migrations. Tests register and sign in through the authentication API. The SMTP sender is replaced with an in-memory recorder, so no email is sent. The background notification worker is disabled; notification generation is exercised directly with a fixed clock.

## Coverage

- `CriticalTripFlowTests`: saved trip details and edits, date/itinerary consistency, invalid creation, invitation lifecycle, role changes, revocation, expense totals and mutations, cross-trip IDs, and account isolation.
- `TripCreationTests`: creation timestamps, edit preservation, and migration preservation of legacy trips.
- `PasswordResetTests`: reset delivery and login, account privacy, invalid and expired codes, password validation, and unavailable email delivery.
- `CalendarTests`: date boundaries, activities, and owned/shared trip access.
- `SettingsTests`: account preference persistence, validation, isolation, and default currency behavior.
- `ReminderEmailTests`: opt-in defaults, account isolation, persistence, provider configuration, retry delays/exhaustion, lease recovery, and cancellation for revoked or obsolete reminders.
- `NotificationTests`: time-zone-aware generation, duplicate prevention, read state, and access revocation.

These are HTTP/database integration tests. Browser layout, native notifications, and browser printing require separate browser verification. Existing NuGet audit warnings are recorded in `TASKS.md` and are not suppressed by this test suite.
