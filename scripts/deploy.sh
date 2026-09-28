#!/usr/bin/env bash
set -euo pipefail
cd /opt/tripplanner/deploy
image="${1:?Provide an immutable image digest}"
[[ "$image" =~ ^ghcr.io/[a-z0-9_.-]+/[a-z0-9_.-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
exec 9>/opt/tripplanner/deploy/.deployment.lock
flock -n 9 || { echo 'Another deployment is in progress'; exit 1; }
docker pull "$image"
if [[ -f data/tripplanner.db ]]; then
  docker compose run --rm --no-deps backup python /tools/backup.py backup /data /backups
fi
# Keep the prior image selection for a deliberate rollback; never downgrade the database automatically.
cp .env .env.previous
chmod 600 .env.previous
python3 - "$image" <<'PY'
import pathlib,sys
p=pathlib.Path('.env'); lines=p.read_text().splitlines()
lines=[line for line in lines if not line.startswith('TRIPPLANNER_IMAGE=')]
lines.append('TRIPPLANNER_IMAGE='+sys.argv[1]); p.write_text('\n'.join(lines)+'\n')
PY
docker compose up -d --remove-orphans
for attempt in $(seq 1 30); do
  if docker compose exec -T monitor python -c 'import urllib.request; urllib.request.urlopen("http://app:8080/health/ready", timeout=3)' >/dev/null 2>&1; then
    echo 'Production image is ready. Verify the public URL and monitoring status.'
    exit 0
  fi
  sleep 2
done
echo 'Readiness failed. Inspect docker compose logs; .env.previous and a validated backup are available. No database rollback was attempted.' >&2
exit 1
