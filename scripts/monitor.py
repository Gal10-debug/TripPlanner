"""Independent watchdog: database, jobs, SMTP configuration/failures, and backup freshness."""
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.request

last_sent = 0
previous = None
failures = 0
while True:
    issues = []
    try:
        request = urllib.request.Request(os.environ['MONITOR_URL'], headers={'Authorization': 'Bearer ' + os.environ['Monitoring__Token']})
        with urllib.request.urlopen(request, timeout=10) as response:
            status = json.load(response)
        if status.get('status') != 'healthy':
            issues.append(status)  # The endpoint returns counts only, never recipient or trip data.
    except Exception as error:
        issues.append({'status': 'unreachable', 'type': type(error).__name__})
    try:
        success = dt.datetime.fromisoformat(Path('/backups/last-success.txt').read_text().strip())
        if dt.datetime.now(dt.timezone.utc) - success > dt.timedelta(hours=8):
            issues.append({'backup': 'stale'})
    except (OSError, ValueError):
        issues.append({'backup': 'missing'})
    failures = failures + 1 if issues else 0
    current = 'degraded' if failures >= 3 else 'healthy' if not issues else None
    if current and (current != previous or (current == 'degraded' and time.time() - last_sent > 3600)):
        payload = {'service': 'TripPlanner', 'status': current, 'issues': issues, 'observedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        print(json.dumps(payload), flush=True)
        webhook = os.getenv('ALERT_WEBHOOK_URL')
        try:
            if webhook:
                if not webhook.startswith('https://'):
                    raise ValueError('Alert webhooks must use HTTPS')
                with urllib.request.urlopen(urllib.request.Request(webhook, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}), timeout=10):
                    pass
            previous, last_sent = current, time.time()
        except Exception as error:
            print('Alert delivery failed: ' + type(error).__name__, flush=True)
    time.sleep(60)
