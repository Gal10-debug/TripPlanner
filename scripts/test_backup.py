import sqlite3
import tempfile
import unittest
from pathlib import Path
from backup import backup, restore


class BackupTests(unittest.TestCase):
    def test_online_wal_snapshot_restore_and_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / 'data'
            (data / 'keys').mkdir(parents=True)
            (data / 'keys/key.xml').write_text('test key only')
            with sqlite3.connect(data / 'tripplanner.db') as conn:
                conn.execute('PRAGMA journal_mode=WAL')
                conn.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT)')
                conn.execute("INSERT INTO __EFMigrationsHistory VALUES ('test')")
                conn.commit()
                archive = backup(data, root / 'backups')
                restore(archive, root / 'restored')
                with sqlite3.connect(root / 'restored/tripplanner.db') as restored:
                    self.assertEqual(restored.execute('SELECT MigrationId FROM __EFMigrationsHistory').fetchone()[0], 'test')
                self.assertEqual((root / 'restored/keys/key.xml').read_text(), 'test key only')
                with self.assertRaises(RuntimeError):
                    restore(archive, data)
                archive.write_bytes(b'corrupt archive')
                with self.assertRaises(RuntimeError):
                    restore(archive, root / 'corrupt')


if __name__ == '__main__':
    unittest.main()
