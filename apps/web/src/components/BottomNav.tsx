export type Page = 'practice' | 'settings' | 'stats';

const ITEMS: { page: Page; label: string }[] = [
  { page: 'practice', label: 'Practice' },
  { page: 'settings', label: 'Settings' },
  { page: 'stats', label: 'Stats' },
];

export function BottomNav({ current }: { current: Page }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ page, label }) => (
        <a
          key={page}
          href={`#/${page}`}
          className="bottom-nav-item"
          aria-current={page === current ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
