import { useEffect, useState } from 'react';
import { startOutboxSync } from './api/instance';
import { BottomNav, type Page } from './components/BottomNav';
import { EarPage } from './pages/EarPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

function pageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').split('/')[0];
  return hash === 'ear' || hash === 'settings' || hash === 'stats' ? hash : 'practice';
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(startOutboxSync, []);

  return (
    <div className="app">
      <main className="page">
        {page === 'practice' && <PracticePage />}
        {page === 'ear' && <EarPage />}
        {page === 'settings' && <SettingsPage />}
        {page === 'stats' && <StatsPage />}
      </main>
      <BottomNav current={page} />
    </div>
  );
}
