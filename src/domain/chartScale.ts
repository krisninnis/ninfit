/**
 * Chart scaling that refuses to lie in either direction.
 *
 * There are two opposite ways a small chart misleads:
 *
 *   - Anchoring at zero flattens everything. A resting heart rate moving 72 to 69 is
 *     invisible on a 0-72 axis.
 *   - Fitting tightly to the data exaggerates everything. Weight moving 69.9 to 70.1
 *     would fill the full height and look like a dramatic change.
 *
 * The fix is a per-metric `minSpan`: the smallest range the axis is allowed to cover.
 * A 0.2 kg change plotted on an axis at least 2 kg tall reads as the small change it
 * is. Counts such as steps genuinely start at zero, so they opt in with `includeZero`.
 */

export interface ChartScale {
  min: number;
  max: number;
  /** Always greater than zero, so callers can divide safely. */
  span: number;
}

export interface ScaleOptions {
  /** Smallest range the axis may cover. Prevents exaggerating tiny differences. */
  minSpan?: number;
  /** True for counts, where zero is a meaningful floor. */
  includeZero?: boolean;
  /** Head and foot room, as a fraction of the span. */
  paddingRatio?: number;
}

/** Sensible floors per metric, in the metric's own units. */
export const MIN_SPAN = {
  weightKg: 2,
  waistCm: 4,
  restingHeartRateBpm: 10,
  hrvMs: 20,
  sleepHours: 2,
  scale10: 4,
} as const;

/**
 * Undefined when there is nothing to plot. A single reading still produces a scale,
 * centred on that value, so one point sits mid-height rather than implying a trend.
 */
export function computeScale(
  values: readonly number[],
  options: ScaleOptions = {},
): ChartScale | undefined {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return undefined;

  const minSpan = options.minSpan ?? 1;
  const paddingRatio = options.paddingRatio ?? 0.1;

  let low = Math.min(...usable);
  let high = Math.max(...usable);

  if (options.includeZero === true) {
    low = Math.min(0, low);
  }

  // Widen symmetrically until the axis covers at least minSpan.
  const span = high - low;
  if (span < minSpan) {
    const midpoint = (high + low) / 2;
    low = midpoint - minSpan / 2;
    high = midpoint + minSpan / 2;
    if (options.includeZero === true && low < 0) {
      low = 0;
      high = Math.max(minSpan, high);
    }
  }

  const padding = (high - low) * paddingRatio;
  const paddedLow = options.includeZero === true ? low : low - padding;
  const paddedHigh = high + padding;

  return { min: paddedLow, max: paddedHigh, span: paddedHigh - paddedLow };
}

/** Where a value sits on the axis, 0 at the bottom and 1 at the top. */
export function scalePosition(value: number, scale: ChartScale): number {
  if (scale.span <= 0) return 0.5;
  return (value - scale.min) / scale.span;
}
