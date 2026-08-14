import { computeScale, scalePosition, type ScaleOptions } from '../../domain/chartScale';
import { differenceInDays } from '../../domain/dates';
import type { MetricPoint } from '../../domain/progress';

/**
 * A small inline-SVG trend line. No charting dependency.
 *
 * Two honesty rules:
 *
 *   - Points are placed by DATE, not by index, so a fortnight's gap between two
 *     readings looks like a gap rather than a neat regular series.
 *   - Every actual reading gets a visible dot, so it is clear where the data is and
 *     where the line is merely travelling between readings.
 *
 * The vertical scale comes from `computeScale`, which enforces a per-metric minimum
 * span so a 0.2 kg change cannot be drawn as a dramatic climb.
 */

interface SparklineProps {
  points: readonly MetricPoint[];
  scaleOptions?: ScaleOptions;
  /** Accessible description; the chart itself is decorative without it. */
  label: string;
  height?: number;
}

const WIDTH = 300;

export function Sparkline({ points, scaleOptions, label, height = 64 }: SparklineProps) {
  if (points.length === 0) return null;

  const scale = computeScale(
    points.map((point) => point.value),
    scaleOptions,
  );
  if (scale === undefined) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return null;

  const totalDays = Math.max(1, differenceInDays(first.date, last.date));
  const padding = 6;
  const usableHeight = height - padding * 2;

  const coordinates = points.map((point) => {
    const x =
      points.length === 1 ? WIDTH / 2 : (differenceInDays(first.date, point.date) / totalDays) * WIDTH;
    const y = padding + (1 - scalePosition(point.value, scale)) * usableHeight;
    return { x, y };
  });

  const path = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {points.length > 1 ? (
        <polyline
          className="spark__line"
          points={path}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {coordinates.map(({ x, y }, index) => (
        <circle key={points[index]?.date ?? index} className="spark__dot" cx={x} cy={y} r="3.5" />
      ))}
    </svg>
  );
}
