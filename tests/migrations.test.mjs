import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/db.mjs';
test('database startup preserves existing merchant data and records the schema version', () => {
  const path = join(
    mkdtempSync(join(tmpdir(), 'checkout-migration-')),
    'service.sqlite',
  );
  let db = openDatabase(path);
  db.prepare('INSERT INTO merchants VALUES(?,?,?,?,?,?)').run(
    'merchant',
    'address',
    'hash',
    'url',
    'secret',
    '100',
  );
  db.exec(
    'DROP TABLE merchant_sessions; DROP TABLE auth_challenges; PRAGMA user_version=0',
  );
  db.close();
  db = openDatabase(path);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM merchants').get().count,
      1,
    );
  } finally {
    db.close();
  }
});
test('older service refuses a database migrated by newer code', () => {
  const path = join(
      mkdtempSync(join(tmpdir(), 'checkout-future-')),
      'service.sqlite',
    ),
    db = openDatabase(path);
  db.exec('PRAGMA user_version=3');
  db.close();
  assert.throws(() => openDatabase(path), /DATABASE_VERSION_TOO_NEW/);
});
