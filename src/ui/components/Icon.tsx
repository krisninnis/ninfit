/**
 * The small set of inline SVG icons the app needs. No icon dependency.
 *
 * `AttentionIcon` exists for one reason: attention states must never be carried by
 * colour alone. Amber plus a symbol plus words survives greyscale, colour-vision
 * differences, and - once Phase 4 gives each fitness path its own accent - stays
 * distinguishable from "this is just the accent colour".
 */

interface IconProps {
  className?: string;
}

export function AttentionIcon({ className = 'icon-attention' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}
