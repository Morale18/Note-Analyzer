import { DEFAULT_SETTINGS, settingsInputSchema, type SettingsInput } from '@fretboard/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api/client';
import { outbox, safeStorage } from './api/instance';

const CACHE_KEY = 'fretboard.settings.v1';

function readCachedSettings(): SettingsInput {
  try {
    const parsed = settingsInputSchema.safeParse(JSON.parse(safeStorage.getItem(CACHE_KEY) ?? ''));
    if (parsed.success) return parsed.data;
  } catch {
    // Nothing usable cached.
  }
  return DEFAULT_SETTINGS;
}

function cacheSettings(settings: SettingsInput): void {
  safeStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

interface SettingsContextValue {
  settings: SettingsInput;
  saveSettings: (settings: SettingsInput) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readCachedSettings);

  useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((remote) => {
        // A queued local edit is newer than whatever the server has.
        if (cancelled || outbox.hasPendingSettings()) return;
        const input = settingsInputSchema.parse(remote);
        setSettings(input);
        cacheSettings(input);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback((next: SettingsInput) => {
    setSettings(next);
    cacheSettings(next);
    outbox.enqueue({ kind: 'settings', settings: next });
  }, []);

  const value = useMemo(() => ({ settings, saveSettings }), [settings, saveSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
