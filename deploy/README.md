# Production runbook

This deployment targets a single Linux host with Docker Engine and Compose v2, Python 3, Git and `flock`. The app, proxy, backup process and watchdog run as separate containers. Domain, hosting, SMTP and alert credentials must be supplied before launch; the repository does not provision a cloud account or deploy automatically.

## Provision the host

1. Point your domain's DNS A/AAAA records to the server. Only advertise working IPv6. Allow inbound TCP 80/443 and administrative SSH; restrict SSH to your administration/CI access policy. Do not publish port 8080. Caddy obtains and renews TLS certificates using the domain and ACME email.
2. Clone the reviewed repository release to `/opt/tripplanner`. Keep its `deploy` and `scripts` directories updated deliberately with each infrastructure change: the application image deployment does not update these host files. Give the deployment SSH user access to Docker and this directory; Docker access is administrative access to the host.
3. In `/opt/tripplanner/deploy`, copy `.env.example` to `.env`, restrict it to mode 600, and supply every value. Set `TRIPPLANNER_IMAGE` to the digest from a successful main CI build, for example `ghcr.io/owner/tripplanner@sha256:<64 hex characters>`. Generate a random monitoring token (`openssl rand -hex 32`). Configure a real HTTPS alert webhook accepting JSON `service`, `status`, `issues` and `observedAt` fields, or adapt `scripts/monitor.py` to your provider. Without a webhook, alerts only reach container logs. Use single-quoted Compose env values when credentials contain literal `$` characters; never commit secrets.
4. Create `data/keys` and `backups`, assign ownership recursively to UID/GID 1654 and mode 700 to these directories. The application and backup containers use this UID. Persist and protect both directories; never delete the key ring during upgrades. Keys are protected by filesystem permissions, not encrypted at rest by the app: use encrypted host storage and encrypted off-host backups.
5. If GHCR is private, authenticate Docker on this host with a read-packages credential. Confirm the configured Docker subnet `172.30.42.0/24` does not conflict with host networks. If changing it, update the explicit trusted proxy IP too.
6. Run `docker compose config --quiet`, then `docker compose up -d`. Check `docker compose logs --tail=100 app caddy backup monitor` and `https://your-domain/health/ready`. Visit `/trips` directly and refresh after signing in.

The app requires an HTTPS `Hosting__PublicOrigin` and persistent `Hosting__DataProtectionPath` outside Development. CORS accepts that origin; extra origins can be configured with `Hosting__AllowedOrigins__0` etc. Forwarded IP/protocol headers are trusted only from the configured Caddy address. HSTS and secure authentication cookies are enabled. Caddy blocks public `/ops/*` access. Do not move the app onto a directly exposed port or trust arbitrary proxies.

## GitHub CI/CD setup

- Allow GitHub Actions and GHCR package publication. CI runs on pull requests and main pushes. Require the checks and browser jobs in main's branch protection, and require reviewed PRs. Main image publication waits for both jobs.
- Create a GitHub environment named `production`, restrict it to main, and configure required reviewers where your GitHub plan supports them. Deployment is explicitly dispatched with a digest from a successful main CI run; no workflow deploys a pull request. The operator is responsible for selecting that verified digest.
- Set environment secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`. Obtain the host key fingerprint through a trusted provisioning channel; do not accept an unverified key scan. Use a dedicated deployment key and rotate it.
- Make `/opt/tripplanner/scripts/deploy.sh` executable. Dispatch **Deploy production** from main. It pulls the immutable image, takes a pre-upgrade snapshot if a database exists, serializes deployments, starts Compose, and waits for readiness.
- On failure, inspect logs and health before retrying. `.env.previous` retains the prior image selection. Do not automatically downgrade an image after schema changes: verify compatibility or stop the app and restore the matching database/key backup as a deliberate recovery. Restoring loses writes after the backup; communicate the recovery window.

GitHub workflows must be pushed and enabled to run; their presence locally is not evidence that a hosted pipeline or deployment has passed. Containers use maintained base-image tags; rebuild regularly and review Dependabot updates.

## Monitoring and response

`/health/live` checks process availability; `/health/ready` queries the database schema and returns 503 on database failure. Readiness intentionally does not depend on SMTP. Configure an **external** uptime check against the public readiness URL and an alert recipient: the same-host watchdog cannot report host-wide outages.

The private `/ops/status` endpoint requires the monitoring bearer token and returns aggregate counts only. The watchdog polls each minute, alerts after three consecutive failures, repeats unresolved alerts hourly and reports recovery. It checks database availability, workers that have not completed a cycle for five minutes (with startup grace), disabled workers, missing SMTP configuration, failed or overdue email jobs, pending queue counts of at least 100, and backups older than eight hours. Inspect privately with:

```sh
docker compose exec -T monitor python -c 'import os,urllib.request; r=urllib.request.Request("http://app:8080/ops/status",headers={"Authorization":"Bearer "+os.environ["Monitoring__Token"]}); print(urllib.request.urlopen(r).read().decode())'
```

When alerted, inspect app/worker logs, disk space and file permissions, SMTP credentials/provider status, and the age/attempt counts of pending deliveries. Fix the cause before retrying or modifying queue rows. Historical terminal failures remain visible until their records are pruned or deliberately remediated; do not blindly clear delivery records. The status endpoint does not send a test email and cannot prove inbox delivery. Configure host disk/certificate monitoring and bounded Docker log rotation on the server as well.

Test alerts before launch by stopping the app in staging and verifying an alert and recovery. Exercise a failing SMTP sender in staging, confirm job retries/status and the alert destination, then restore configuration. Check that external monitoring detects the whole host going unavailable.

## Backups and restore drills

The backup container makes an online SQLite snapshot every six hours, validates database integrity/foreign keys/migration history, and packages it with the Data Protection key ring and a SHA-256 manifest. Local retention is 14 days. A failed backup does not update the success marker. This gives a nominal recovery point of six hours, provided monitoring and copies are working.

Copy archives **and their `.json` manifests** to encrypted off-host storage after each successful backup. This requires your storage provider's transfer/retention configuration; local backups alone do not survive loss of the server. Restrict access as tightly as the live database: exports, booking addresses and authentication keys are sensitive. Align off-host retention with your privacy policy and local retention. Checksums detect accidental corruption, not malicious tampering; protect the backup store.

For an immediate snapshot, from the deployment directory:

```sh
docker compose run --rm --no-deps backup python /tools/backup.py backup /data /backups
```

Before launch and at least monthly, restore a chosen archive into a new, empty directory using Python 3.13 (or the same Python container):

```sh
python3 ../scripts/backup.py restore backups/tripplanner-TIMESTAMP.tar.gz /safe/empty/restore-drill
```

The restore command rejects nonempty destinations and validates the manifest, database and keys. Boot the matching application image against the restored directory in an isolated staging network, with the restored keys and a staging public origin. Disable both workers (`PasswordReset__DisableWorker=true`, `Notifications__DisableWorker=true`) and omit SMTP credentials so a drill cannot email real users. Use a designated test account to verify sign-in, trip reads and ownership, and record date, backup timestamp, image digest, recovery time and result. Do not expose a restored production dataset publicly. Remove the drill data afterward.

For actual recovery, stop the app, preserve the damaged data for diagnosis, restore into an empty directory, set UID/GID 1654 ownership, then point the app at that directory with its matching keys and compatible image. Reapply account deletions made after the snapshot before reopening access; a database restore can otherwise resurrect deleted accounts. Maintain a restricted deletion/recovery procedure outside the restored database. Backups naturally retain deleted data until expiry; account deletion does not rewrite historical archives.

## Launch acceptance

- A successful hosted CI run including real Chromium browser tests, plus a built/running Linux container.
- Correct DNS/TLS, HTTPS redirect, secure cookies, direct-route refresh and rejected unknown API routes.
- Working persistent database and key ring across a container restart, a recorded restore drill, and encrypted off-host backup transfer.
- Tested external uptime and internal queue/worker/SMTP/backup alerts with a responsible recipient.
- Configure a verified SMTP sender and provider-required SPF/DKIM/DMARC records. Register a controlled test account and request a reset from the production UI. Confirm arrival in the actual inbox, complete reset and sign in with the new password. Confirm opted-in reminder delivery too. A successful SMTP transaction alone is insufficient.
- Manually inspect Hebrew/mobile layouts, a printed/PDF summary and native browser notifications on supported devices. Browser alerts require an open app; closed-app Web Push is future work.

Keep one API instance. Horizontal scaling requires a shared database, shared job infrastructure and distributed coordination; increasing Compose replicas is unsupported.
