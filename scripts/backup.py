"""Consistent online SQLite snapshot plus matching Data Protection keys; no live-file copying."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile
from urllib.parse import quote


def check(database):
    with sqlite3.connect(f"file:{quote(str(Path(database).resolve()))}?mode=ro", uri=True) as conn:
        if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('SQLite integrity check failed')
        if conn.execute('PRAGMA foreign_key_check').fetchone() is not None:
            raise RuntimeError('SQLite foreign key check failed')
        if not conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='__EFMigrationsHistory'").fetchone()[0]:
            raise RuntimeError('Migration history is missing')


def backup(data, output):
    data, output = Path(data), Path(output)
    output.mkdir(parents=True, exist_ok=True)
    os.chmod(output, 0o700)
    keys = data / 'keys'
    if not list(keys.glob('*.xml')):
        raise RuntimeError('Refusing backup without a Data Protection key ring')
    name = 'tripplanner-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.tar.gz'
    with tempfile.TemporaryDirectory(dir=output) as work:
        snapshot = Path(work) / 'tripplanner.db'
        with sqlite3.connect(f"file:{quote(str((data / 'tripplanner.db').resolve()))}?mode=ro", uri=True) as source:
            with sqlite3.connect(snapshot) as destination:
                source.backup(destination)
        check(snapshot)
        temporary = output / (name + '.partial')
        with tarfile.open(temporary, 'w:gz') as archive:
            archive.add(snapshot, arcname='tripplanner.db')
            archive.add(keys, arcname='keys')
        os.chmod(temporary, 0o600)
        final = output / name
        temporary.rename(final)
        manifest = {'file': name, 'sha256': hashlib.sha256(final.read_bytes()).hexdigest(), 'createdAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        (output / (name + '.json')).write_text(json.dumps(manifest))
        # Atomic marker is written only after snapshot validation and archive completion.
        marker = output / '.last-success.tmp'
        marker.write_text(manifest['createdAt'])
        marker.replace(output / 'last-success.txt')
        return final


def restore(archive, destination):
    archive, destination = Path(archive), Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise RuntimeError('Restore destination must be empty; never overwrite a live database')
    manifest = json.loads(Path(str(archive) + '.json').read_text())
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
        raise RuntimeError('Backup checksum mismatch')
    destination.mkdir(parents=True, exist_ok=True)
    os.chmod(destination, 0o700)
    with tarfile.open(archive) as source:
        source.extractall(destination, filter='data')
    check(destination / 'tripplanner.db')
    if not list((destination / 'keys').glob('*.xml')):
        raise RuntimeError('Restored key ring is missing')


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['backup', 'restore'])
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    if args.command == 'backup':
        print(backup(args.source, args.destination))
    else:
        restore(args.source, args.destination)
        print('Restore integrity checks passed')
