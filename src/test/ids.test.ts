import { describe, expect, it } from 'vitest';
import { isUuid, newId, sequentialIdFactory } from '../domain/ids';

describe('newId', () => {
  it('produces a valid v4 UUID', () => {
    expect(isUuid(newId())).toBe(true);
  });

  it('does not collide over a large batch', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
  });
});

describe('isUuid', () => {
  it('rejects anything that is not a UUID', () => {
    expect(isUuid('id-1')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
  });
});

describe('sequentialIdFactory', () => {
  it('produces stable ids for tests', () => {
    const makeId = sequentialIdFactory('log');
    expect([makeId(), makeId(), makeId()]).toEqual(['log-1', 'log-2', 'log-3']);
  });

  it('gives each factory its own counter', () => {
    const a = sequentialIdFactory('a');
    const b = sequentialIdFactory('b');
    a();
    expect(b()).toBe('b-1');
  });
});
