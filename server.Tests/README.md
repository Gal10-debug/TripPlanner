# Integration tests

Run from the repository root:

```sh
dotnet test TripPlanner.slnx --no-restore --verbosity minimal -m:1
```

Each `ResetApplication` factory starts the real ASP.NET Core application with an isolated temporary SQLite database and applies the actual migrations. Tests register and sign in through the authentication API. The SMTP sender is replaced with an in-memory recorder, so no email is sent. The notification and password-reset workers are disabled; queue delivery and notification generation are exercised directly with controlled clocks. Restart recovery uses a temporary persisted key ring and the same SQLite database across two application instances.

## Coverage

- `CriticalTripFlowTests`: saved trip details and edits, date/itinerary consistency, invalid creation, invitation lifecycle, role changes, revocation, expense totals and mutations, cross-trip IDs, and account isolation.
- `TripCreationTests`: creation timestamps, edit preservation, and migration preservation of legacy trips.
- `PasswordResetTests`: reset delivery and login, account privacy, invalid and expired codes, password validation, and unavailable email delivery.
- `PasswordResetReliabilityTests`: durable cooldowns, concurrent deduplication, retry delays/exhaustion, expiry/cleanup, password changes, restart recovery, database failures, route aliases, and shared IP limits.
- `PasswordResetRateLimitingTests`: aggregate limits across different IPs without throttling unrelated endpoints.
- `CalendarTests`: date boundaries, activities, and owned/shared trip access.
- `SettingsTests`: account preference persistence, validation, isolation, and default currency behavior.
- `ReminderEmailTests`: opt-in defaults, account isolation, persistence, provider configuration, retry delays/exhaustion, lease recovery, and cancellation for revoked or obsolete reminders.
- `NotificationTests`: time-zone-aware generation, duplicate prevention, read state, and access revocation.

These are HTTP/database integration tests. Browser layout, native notifications, and browser printing require separate browser verification. The dependency overrides remove the two previously reported NuGet advisories; no warnings are suppressed. Run `dotnet list TripPlanner.slnx package --vulnerable --include-transitive` before deployment.
