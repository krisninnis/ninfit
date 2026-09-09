import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const javaRoot = join(ROOT, 'android', 'app', 'src', 'main', 'java', 'app', 'ninfit', 'mobile');
const store = readFileSync(join(javaRoot, 'JourneyDurableStore.java'), 'utf8');
const plugin = readFileSync(join(javaRoot, 'NinFitJourneyQueuePlugin.java'), 'utf8');
const activity = readFileSync(join(javaRoot, 'MainActivity.java'), 'utf8');

describe('Android Journey durable store contract', () => {
  it('uses app-private SQLite with separate monotonic cursor and pending-position tables', () => {
    expect(store).toContain('extends SQLiteOpenHelper');
    expect(store).toContain('CREATE TABLE journey_cursor');
    expect(store).toContain('next_sequence INTEGER NOT NULL');
    expect(store).toContain('CREATE TABLE journey_position');
    expect(store).toContain('PRIMARY KEY (journey_id, sequence)');
    expect(store).toContain('MAX_PENDING_POSITIONS = 10_000');
  });

  it('commits append and cursor advancement in one transaction before a caller can deliver the fix', () => {
    const append = store.slice(store.indexOf('long append('), store.indexOf('JSONArray readPending('));
    expect(append).toContain('db.beginTransaction();');
    expect(append).toContain('db.insertOrThrow("journey_position"');
    expect(append).toContain('journey_cursor');
    expect(append).toContain('sequence + 1L');
    expect(append).toContain('db.setTransactionSuccessful();');
    expect(append.indexOf('db.insertOrThrow("journey_position"')).toBeLessThan(
      append.indexOf('db.setTransactionSuccessful();'),
    );
  });

  it('acknowledges only pending rows and deliberately keeps the monotonic cursor until terminal clear', () => {
    const acknowledge = store.slice(store.indexOf('int acknowledgeThrough('), store.indexOf('void clear('));
    expect(acknowledge).toContain('sequence <= ?');
    expect(acknowledge).not.toContain('db.delete("journey_cursor"');

    const clear = store.slice(store.indexOf('void clear('));
    expect(clear).toContain('db.delete("journey_position"');
    expect(clear).toContain('db.delete("journey_cursor"');
  });

  it('exposes only queue operations to JavaScript and keeps native append private to Android code', () => {
    expect(plugin).toContain('@CapacitorPlugin(name = "NinFitJourneyQueue")');
    expect(plugin).toContain('public void readPending(PluginCall call)');
    expect(plugin).toContain('public void acknowledgeThrough(PluginCall call)');
    expect(plugin).toContain('public void clear(PluginCall call)');
    expect(plugin).not.toContain('public void append(');
    expect(activity).toContain('registerPlugin(NinFitJourneyQueuePlugin.class);');
  });
});
