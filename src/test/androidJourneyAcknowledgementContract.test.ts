import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const javaRoot = join(ROOT, 'android', 'app', 'src', 'main', 'java', 'app', 'ninfit', 'mobile');
const read = (name: string) => readFileSync(join(javaRoot, name), 'utf8');

const plugin = read('NinFitJourneyQueuePlugin.java');
const store = read('JourneyDurableStore.java');
const service = read('JourneyForegroundLocationService.java');
const capture = read('JourneyNativeCapture.java');
const bridge = readFileSync(join(ROOT, 'src', 'app', 'journeyCapacitorDurableQueueBridge.ts'), 'utf8');

const capacitorPluginCall = readFileSync(
  join(
    ROOT, 'node_modules', '@capacitor', 'android', 'capacitor', 'src', 'main',
    'java', 'com', 'getcapacitor', 'PluginCall.java',
  ),
  'utf8',
);

function capacitorGetter(name: string): string {
  const start = capacitorPluginCall.indexOf(`public ${name}(String name, @Nullable`);
  expect(start, `Capacitor PluginCall.${name} moved or was renamed`).toBeGreaterThan(-1);
  const end = capacitorPluginCall.indexOf('\n    }', start);
  return capacitorPluginCall.slice(start, end);
}

/*
 * THE DRIFT THIS EXISTS TO CATCH.
 *
 * A JavaScript/Java argument mismatch compiles, passes typecheck, passes every
 * TypeScript test, passes `cap sync`, passes `assembleDebug` and passes the Verification
 * Gate. It fails only on a phone. That is exactly what happened: the durable
 * acknowledgement was addressed by a property name and type that could never arrive, and
 * the first evidence was a Samsung stuck at sequence 1 for six minutes.
 *
 * So these tests pin the boundary itself: the method names, the argument names, the
 * argument types the plugin will accept, the response the plugin promises, and the
 * store identity behind it.
 */

describe('why NinFit cannot use PluginCall.getLong for a JavaScript sequence', () => {
  /*
   * This reads the installed Capacitor source, so it documents the dependency rather
   * than an assumption about it. If this test ever fails, Capacitor has changed its
   * numeric widening: read the new behaviour, then decide - NinFit's own reader stays
   * correct either way, so the fix does not depend on this staying true.
   */
  it('widens an Integer for getDouble and getFloat but not for getInt or getLong', () => {
    expect(capacitorGetter('Double getDouble')).toContain('value instanceof Integer');
    expect(capacitorGetter('Float getFloat')).toContain('value instanceof Integer');

    const getLong = capacitorGetter('Long getLong');
    expect(getLong).toContain('value instanceof Long');
    expect(getLong).not.toContain('instanceof Integer');

    const getInt = capacitorGetter('Integer getInt');
    expect(getInt).toContain('value instanceof Integer');
    expect(getInt).not.toContain('instanceof Long');
  });
});

describe('Android Journey acknowledgement contract', () => {
  it('never reads a JavaScript-supplied number through a non-widening Capacitor getter', () => {
    // org.json boxes every integral JSON literal inside the int range as an Integer, so
    // `call.getLong(...)` is null for every sequence a real Journey reaches. Reading the
    // boxed value directly is the only shape that survives both boxings.
    expect(plugin).not.toContain('call.getLong(');
    expect(plugin).not.toContain('call.getInt(');
    expect(plugin).toContain('call.getData().opt("sequence")');
  });

  it('accepts every integral numeric boxing and refuses everything else', () => {
    const requireSequence = plugin.slice(
      plugin.indexOf('private static long requireSequence('),
      plugin.indexOf('public void readPending('),
    );
    expect(requireSequence).toContain('raw instanceof Integer');
    expect(requireSequence).toContain('raw instanceof Long');
    expect(requireSequence).toContain('raw instanceof Double');
    // Fail-closed guards: fractional, non-finite, out-of-range and non-numeric all throw.
    expect(requireSequence).toContain('Math.floor(numeric)');
    expect(requireSequence).toContain('Double.isNaN(numeric)');
    expect(requireSequence).toContain('Double.isInfinite(numeric)');
    expect(requireSequence).toContain('throw new IllegalArgumentException');
    expect(plugin).toContain('MAX_SEQUENCE = 9007199254740991L');

    /*
     * The bounds, pinned exactly. Sequences are 1-based: the native store's own cursor
     * starts at 1 and `append` never issues 0, so a 0 arriving here means a caller that
     * has lost track of the prefix, not an empty acknowledgement. Both the boxed-integer
     * path and the double path must refuse it. `journeyNativeAcknowledgementBoundary`
     * exercises these same bounds through the transcribed reader; this is what keeps the
     * transcription honest about the Java it stands in for.
     */
    expect(requireSequence).toContain('sequence < 1L || sequence > MAX_SEQUENCE');
    expect(requireSequence).toContain('numeric < 1d || numeric > (double) MAX_SEQUENCE');
    expect(store).toContain('if (sequence < 1L) throw new IllegalArgumentException');
  });

  it('pins the JS method names to the Java @PluginMethod names', () => {
    for (const method of ['readPending', 'acknowledgeThrough', 'clear']) {
      expect(plugin).toContain(`public void ${method}(PluginCall call)`);
      expect(bridge).toContain(`${method}(options:`);
    }
    expect(plugin).toContain('@CapacitorPlugin(name = "NinFitJourneyQueue")');
    expect(bridge).toContain("registerPlugin<NinFitJourneyQueuePlugin>('NinFitJourneyQueue')");
  });

  it('pins the argument property names on both sides of the bridge', () => {
    expect(plugin).toContain('call.getString("journeyId")');
    expect(plugin).toContain('opt("sequence")');
    expect(bridge).toContain('{ journeyId: string; sequence: number }');
    expect(bridge).toContain('plugin.acknowledgeThrough({ journeyId, sequence })');
  });

  it('pins the acknowledgement receipt the plugin promises and TypeScript verifies', () => {
    const acknowledge = plugin.slice(
      plugin.indexOf('public void acknowledgeThrough('),
      plugin.indexOf('public void clear('),
    );
    expect(acknowledge).toContain('result.put("journeyId", journeyId)');
    expect(acknowledge).toContain('result.put("acknowledgedThrough", sequence)');
    expect(acknowledge).toContain('result.put("remaining", remaining)');
    expect(acknowledge).toContain('call.resolve(result)');

    for (const field of ['journeyId', 'acknowledgedThrough', 'remaining']) {
      expect(bridge).toContain(field);
    }
    expect(bridge).toContain('assertNativeJourneyAcknowledgementReceipt(receipt, journeyId, sequence)');
  });

  it('keeps acknowledge-through semantics: a prefix, never one record, and never the cursor', () => {
    const acknowledge = store.slice(
      store.indexOf('int acknowledgeThrough('),
      store.indexOf('void clear('),
    );
    expect(acknowledge).toContain('"journey_id = ? AND sequence <= ?"');
    expect(acknowledge).not.toContain('sequence = ?');
    expect(acknowledge).not.toContain('db.delete("journey_cursor"');
    // The reported depth is measured inside the transaction that performed the delete.
    expect(acknowledge.indexOf('int remaining = pendingCount(db, journeyId);'))
      .toBeGreaterThan(acknowledge.indexOf('db.delete('));
    expect(acknowledge.indexOf('int remaining = pendingCount(db, journeyId);'))
      .toBeLessThan(acknowledge.indexOf('db.setTransactionSuccessful();'));
  });

  it('keeps one durable store identity behind the writer and the acknowledging plugin', () => {
    expect(store).toContain('DATABASE_NAME = "ninfit_journey_native.db"');
    expect(store).toContain('context.getApplicationContext()');
    // The service appends through JourneyNativeCapture; the plugin acknowledges. Both
    // construct the same SQLiteOpenHelper against the same app-private database name, so
    // there is exactly one durable queue on the device.
    expect(service).toContain('new JourneyDurableStore(this)');
    expect(service).toContain('new JourneyNativeCapture(store)');
    expect(capture).toContain('store.append(');
    expect(plugin).toContain('new JourneyDurableStore(getContext())');
    expect(plugin).not.toContain('public void append(');
  });
});
