import type { ReactNode } from 'react';
import { PRIMARY_NAV, hashForPrimaryNav, type PrimaryNavId } from '../tabs';

interface TabBarProps {
  current: PrimaryNavId;
  onSelect: (id: PrimaryNavId) => void;
}

const ICON_PATHS: Record<PrimaryNavId, ReactNode> = {
  today: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  week: (
    <>
      <rect x="3.5" y="5" width="17" height="14.5" rx="3.5" />
      <path d="M3.5 10h17M3.5 14.75h17M9.5 10v9.5" />
    </>
  ),
  journey: (
    <>
      <path d="M5 18.5c2.5-5 4.5-7 7-7s4.5 2 7 7" />
      <circle cx="6" cy="6" r="2.25" />
      <path d="M6 8.25v3.25" />
    </>
  ),
  progress: (
    <>
      <path d="M4.5 4.5v15h15" />
      <path d="M7.75 15.5l3.5-4 2.75 2.25 4.25-5.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.75" r="3.5" />
      <path d="M5.25 19.5c0-3.2 3.05-5.25 6.75-5.25s6.75 2.05 6.75 5.25" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 .6 1.7 1.7 0 00-.4 1.1V21h-4v-.09A1.7 1.7 0 008.55 19.4a1.7 1.7 0 00-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-.6-1 1.7 1.7 0 00-1.1-.4H3v-4h.09A1.7 1.7 0 004.6 8.55a1.7 1.7 0 00-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-.6 1.7 1.7 0 00.4-1.1V3h4v.09A1.7 1.7 0 0015.45 4.6a1.7 1.7 0 001.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0019.4 9c.39.27.75.6 1 .99.26.39.4.85.4 1.32V12h.2v4h-.09A1.7 1.7 0 0019.4 15z" />
    </>
  ),
};

function TabIcon({ id }: { id: PrimaryNavId }) {
  return (
    <svg
      className="tabbar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[id]}
    </svg>
  );
}

export function TabBar({ current, onSelect }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Main">
      {PRIMARY_NAV.map((item) => {
        const isCurrent = item.id === current;
        return (
          <button
            key={item.id}
            type="button"
            className="tabbar__tab"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => {
              window.location.hash = hashForPrimaryNav(item.id);
              onSelect(item.id);
            }}
          >
            <TabIcon id={item.id} />
            <span className="tabbar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
