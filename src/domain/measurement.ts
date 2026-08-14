import { isValidISODate } from './dates';
import { newId, type IdFactory } from './ids';
import type { ISODate, Measurement } from './types';

/**
 * Ad-hoc body measurements taken by the user.
 *
 * MANUAL ONLY, as documented on the `Measurement` type. Device streams belong in
 * `MetricSample`. Every value except the date is optional: "I weighed myself but
 * forgot the tape measure" is an ordinary and complete measurement.
 */

export interface CreateMeasurementInput {
  recordedOn: ISODate;
  weightKg?: number;
  waistCm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}

export function createMeasurement(
  input: CreateMeasurementInput,
  options: { makeId?: IdFactory } = {},
): Measurement {
  if (!isValidISODate(input.recordedOn)) {
    throw new Error(`Invalid measurement date: ${JSON.stringify(input.recordedOn)}`);
  }

  const measurement: Measurement = {
    id: (options.makeId ?? newId)(),
    recordedOn: input.recordedOn,
  };

  // Only supplied values are written, so an absent reading stays absent instead of
  // becoming a key holding undefined.
  if (input.weightKg !== undefined) measurement.weightKg = input.weightKg;
  if (input.waistCm !== undefined) measurement.waistCm = input.waistCm;
  if (input.restingHeartRateBpm !== undefined) {
    measurement.restingHeartRateBpm = input.restingHeartRateBpm;
  }
  if (input.hrvMs !== undefined) measurement.hrvMs = input.hrvMs;
  if (input.notes !== undefined && input.notes.trim() !== '') measurement.notes = input.notes;

  return measurement;
}

/** True when a measurement holds nothing but a date, and so is not worth storing. */
export function isMeasurementEmpty(measurement: Measurement): boolean {
  return (
    measurement.weightKg === undefined &&
    measurement.waistCm === undefined &&
    measurement.restingHeartRateBpm === undefined &&
    measurement.hrvMs === undefined &&
    (measurement.notes === undefined || measurement.notes.trim() === '')
  );
}

/** Newest first, which is the order the Profile screen lists them in. */
export function sortMeasurementsDescending(measurements: readonly Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) => (a.recordedOn < b.recordedOn ? 1 : -1));
}
