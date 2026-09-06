import type { StorageAdapter } from './StorageAdapter';

const JOURNEY_NAMES_KEY = 'ninfit:journey:names:v1';
const MAX_JOURNEY_NAME_LENGTH = 80;

function parseNames(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] =>
          typeof entry[1] === 'string' && entry[1].trim().length > 0),
    );
  } catch {
    return {};
  }
}

export function normaliseJourneyName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_JOURNEY_NAME_LENGTH);
}

export function journeyName(storage: StorageAdapter, journeyId: string): string | undefined {
  return parseNames(storage.get(JOURNEY_NAMES_KEY))[journeyId];
}

export function saveJourneyName(
  storage: StorageAdapter,
  journeyId: string,
  value: string,
): string | undefined {
  const names = parseNames(storage.get(JOURNEY_NAMES_KEY));
  const name = normaliseJourneyName(value);
  if (name.length === 0) delete names[journeyId];
  else names[journeyId] = name;
  storage.set(JOURNEY_NAMES_KEY, JSON.stringify(names));
  return names[journeyId];
}
