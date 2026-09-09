/**
 * A faithful stand-in for the Android argument boundary that sits between NinFit's
 * JavaScript and its Capacitor plugins.
 *
 * WHY THIS EXISTS. A Journey on a physical Samsung stalled for minutes with a live
 * provider, a live session, a present queue and `stop=acknowledgement_error` every
 * second. Nothing in the TypeScript suite could see it, because every test called the
 * durable queue interface directly and never crossed the bridge. The defect lived
 * entirely in how a JavaScript number arrives at a Java plugin method, so the only test
 * that could have caught it is one that reproduces that crossing.
 *
 * WHAT IS MODELLED, AND WHY IT IS TRUSTWORTHY.
 *
 *  1. Capacitor serialises plugin arguments to JSON and the Android bridge parses them
 *     with `org.json` (`MessageHandler` builds a `JSObject` from the message text). So
 *     the boxing rules here are `org.json.JSONTokener`'s: an integral literal is boxed as
 *     `Integer` when it fits in an int and `Long` otherwise; anything else numeric is a
 *     `Double`. This code decides from the JSON *text*, exactly as the tokeniser does.
 *  2. The getters are transcribed from the installed
 *     `@capacitor/android` `PluginCall.java`. Their asymmetry is the whole defect:
 *     `getDouble`/`getFloat` widen an `Integer`, `getInt`/`getLong` return the default
 *     unless the boxed type matches exactly. `androidJourneyAcknowledgementContract`
 *     pins that transcription against the real file on disk, so this double cannot drift
 *     away from the dependency without a test failing.
 *
 * This is a contract simulation, not an Android runtime. It proves what the bridge does
 * with a value; it cannot prove SQLite, service lifecycle or process death. Those remain
 * the physical-device acceptance run's job.
 */

export type AndroidBoxedValue =
  | { readonly javaType: 'Integer'; readonly value: number }
  | { readonly javaType: 'Long'; readonly value: number }
  | { readonly javaType: 'Double'; readonly value: number }
  | { readonly javaType: 'String'; readonly value: string }
  | { readonly javaType: 'Boolean'; readonly value: boolean }
  | { readonly javaType: 'JSONObject.NULL'; readonly value: null };

const JAVA_INT_MIN = -2147483648;
const JAVA_INT_MAX = 2147483647;

/**
 * Box one already-JSON-serialised value the way `org.json.JSONTokener` does.
 *
 * `JSON.stringify` is what Capacitor sends, so the literal text is the honest input: it
 * is why a JavaScript `1.0` arrives as an `Integer` (it stringifies to `1`) and why a
 * non-finite number arrives as null (it stringifies to `null`).
 */
export function boxAndroidJsonValue(value: unknown): AndroidBoxedValue {
  const text = JSON.stringify(value);
  if (text === undefined || text === 'null') return { javaType: 'JSONObject.NULL', value: null };
  if (typeof value === 'string') return { javaType: 'String', value };
  if (typeof value === 'boolean') return { javaType: 'Boolean', value };
  if (typeof value !== 'number') {
    throw new Error(`This double models only scalar plugin arguments, not ${text}`);
  }
  // JSONTokener treats a literal with no '.', 'e' or 'E' as integral and parses it as a
  // long, boxing to Integer when it fits in an int. Everything else becomes a Double.
  if (/^-?\d+$/.test(text)) {
    const integral = Number(text);
    if (integral >= JAVA_INT_MIN && integral <= JAVA_INT_MAX) {
      return { javaType: 'Integer', value: integral };
    }
    return { javaType: 'Long', value: integral };
  }
  return { javaType: 'Double', value };
}

export interface AndroidJsObject {
  opt(name: string): AndroidBoxedValue | null;
}

/** The subset of `com.getcapacitor.PluginCall` NinFit's plugins use. */
export interface AndroidPluginCall {
  getString(name: string, defaultValue?: string | null): string | null;
  getInt(name: string, defaultValue?: number | null): number | null;
  getLong(name: string, defaultValue?: number | null): number | null;
  getDouble(name: string, defaultValue?: number | null): number | null;
  getFloat(name: string, defaultValue?: number | null): number | null;
  getData(): AndroidJsObject;
}

export function createAndroidPluginCall(options: Record<string, unknown>): AndroidPluginCall {
  // Capacitor stringifies the options object; the bridge parses that text. Round-tripping
  // it here means a key whose value cannot survive JSON (undefined, a function) is absent
  // on the Java side, exactly as it would be on a device.
  const transported = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  const boxed = new Map<string, AndroidBoxedValue>();
  for (const [key, value] of Object.entries(transported)) {
    boxed.set(key, boxAndroidJsonValue(value));
  }

  const data: AndroidJsObject = {
    opt(name) {
      const found = boxed.get(name);
      if (found === undefined) return null;
      // org.json's opt() returns JSONObject.NULL for an explicit null, which is not a
      // Number and therefore fails every numeric instanceof check.
      return found;
    },
  };

  return {
    getData: () => data,
    getString(name, defaultValue = null) {
      const found = data.opt(name);
      if (found === null || found.javaType === 'JSONObject.NULL') return defaultValue;
      return found.javaType === 'String' ? found.value : defaultValue;
    },
    getInt(name, defaultValue = null) {
      const found = data.opt(name);
      if (found === null || found.javaType === 'JSONObject.NULL') return defaultValue;
      return found.javaType === 'Integer' ? found.value : defaultValue;
    },
    getLong(name, defaultValue = null) {
      const found = data.opt(name);
      if (found === null || found.javaType === 'JSONObject.NULL') return defaultValue;
      // The defect, verbatim from PluginCall.java: no widening from Integer.
      return found.javaType === 'Long' ? found.value : defaultValue;
    },
    getDouble(name, defaultValue = null) {
      const found = data.opt(name);
      if (found === null || found.javaType === 'JSONObject.NULL') return defaultValue;
      if (found.javaType === 'Double' || found.javaType === 'Integer') return found.value;
      return defaultValue;
    },
    getFloat(name, defaultValue = null) {
      const found = data.opt(name);
      if (found === null || found.javaType === 'JSONObject.NULL') return defaultValue;
      if (found.javaType === 'Double' || found.javaType === 'Integer') return found.value;
      return defaultValue;
    },
  };
}

/** How a plugin method reads the acknowledgement sequence out of its call. */
export type AndroidSequenceReader = (call: AndroidPluginCall) => number;

const MAX_SEQUENCE = 9007199254740991;

/**
 * What `NinFitJourneyQueuePlugin` shipped in 09f95c6: `call.getLong("sequence")`.
 * Kept so the regression suite can still demonstrate the Samsung failure after the fix.
 */
export const capacitorGetLongSequenceReader: AndroidSequenceReader = (call) => {
  const sequence = call.getLong('sequence');
  if (sequence === null || sequence < 1) {
    throw new Error('Invalid Journey acknowledgement sequence');
  }
  return sequence;
};

/** Transcription of the plugin's own `requireSequence`. */
export const ninfitSequenceReader: AndroidSequenceReader = (call) => {
  const raw = call.getData().opt('sequence');
  let sequence: number;
  if (raw === null || raw.javaType === 'JSONObject.NULL') {
    throw new Error('Invalid Journey acknowledgement sequence');
  } else if (raw.javaType === 'Integer' || raw.javaType === 'Long') {
    sequence = raw.value;
  } else if (raw.javaType === 'Double') {
    const numeric = raw.value;
    if (!Number.isFinite(numeric) || numeric !== Math.floor(numeric)) {
      throw new Error('Invalid Journey acknowledgement sequence');
    }
    if (numeric < 1 || numeric > MAX_SEQUENCE) {
      throw new Error('Invalid Journey acknowledgement sequence');
    }
    sequence = numeric;
  } else {
    throw new Error('Invalid Journey acknowledgement sequence');
  }
  if (sequence < 1 || sequence > MAX_SEQUENCE) {
    throw new Error('Invalid Journey acknowledgement sequence');
  }
  return sequence;
};
