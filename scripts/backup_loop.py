import os
from pathlib import Path
import time
from backup import backup

os.umask(0o077)
while True:
    try:
        backup('/data', '/backups')
        cutoff = time.time() - int(os.getenv('BACKUP_RETENTION_DAYS', '14')) * 86400
        for archive in Path('/backups').glob('tripplanner-*.tar.gz'):
            if archive.stat().st_mtime < cutoff:
                archive.unlink()
                Path(str(archive) + '.json').unlink(missing_ok=True)
        print('Backup completed and validated', flush=True)
    except Exception as error:
        print('Backup failed: ' + type(error).__name__, flush=True)
    time.sleep(int(os.getenv('BACKUP_INTERVAL_SECONDS', '21600')))
