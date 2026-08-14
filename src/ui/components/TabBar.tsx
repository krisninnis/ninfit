import type { ReactNode } from 'react';
import { TABS, hashForTab, type TabId } from '../tabs';

interface TabBarProps {
  current: TabId;
  onSelect: (id: TabId) => void;
}

const ICON_PATHS: Record<TabId, ReactNode> = {
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
  data: (
    <>
      <path d="M12 3.75v9.5M8.5 9.75L12 13.25l3.5-3.5" />
      <path d="M4.75 15v2.25a3 3 0 003 3h8.5a3 3 0 003-3V15" />
    </>
  ),
};

function TabIcon({ id }: { id: TabId }) {
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
      {TABS.map((tab) => {
        const isCurrent = tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            className="tabbar__tab"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => {
              window.location.hash = hashForTab(tab.id);
              onSelect(tab.id);
            }}
          >
            <TabIcon id={tab.id} />
            <span className="tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
