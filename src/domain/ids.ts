import type { UUID } from './types';

/**
 * Stable identifiers.
 *
 * Every entity gets a UUID at creation and keeps it for life, so records survive
 * export, re-import and an eventual move to Postgres without being renumbered.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
};

function getCrypto(): CryptoLike | undefined {
  return typeof globalThis.crypto === 'undefined'
    ? undefined
    : (globalThis.crypto as CryptoLike);
}

/**
 * RFC 4122 v4 identifier.
 *
 * `crypto.randomUUID` is used where available. The fallback still draws from a
 * cryptographic source; it exists only for browsers that expose `getRandomValues`
 * but not `randomUUID`, which includes some older iOS Safari builds.
 */
export function newId(): UUID {
  const cryptoApi = getCrypto();

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    // Set the version (4) and variant (10xx) bits.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  throw new Error('No cryptographic random source available for id generation');
}

export function isUuid(value: unknown): value is UUID {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** A function that mints ids. Injectable so tests can be deterministic. */
export type IdFactory = () => UUID;

/** Sequential ids for tests and fixtures. Never used at runtime. */
export function sequentialIdFactory(prefix = 'id'): IdFactory {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}
