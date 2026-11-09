import type { ReactNode } from 'react';

export type Page = 'practice' | 'ear' | 'tuner' | 'settings' | 'stats';

const ITEMS: { page: Page; label: string; icon: ReactNode }[] = [
  {
    page: 'practice',
    label: 'Practice',
    icon: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
  },
  {
    page: 'ear',
    label: 'Ear',
    icon: (
      <>
        <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
        <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
      </>
    ),
  },
  {
    page: 'tuner',
    label: 'Tuner',
    icon: (
      <>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      </>
    ),
  },
  {
    page: 'settings',
    label: 'Settings',
    icon: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  },
  {
    page: 'stats',
    label: 'Stats',
    icon: <path d="M18 20V10M12 20V4M6 20v-6" />,
  },
];

export function BottomNav({ current }: { current: Page }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ page, label, icon }) => (
        <a
          key={page}
          href={`#/${page}`}
          className="bottom-nav-item"
          aria-current={page === current ? 'page' : undefined}
        >
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
          {label}
        </a>
      ))}
    </nav>
  );
}
