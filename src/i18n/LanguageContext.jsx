import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translate } from './dictionary.js';

const STORAGE_KEY = 'vendorja.lang';
const LanguageContext = createContext(null);

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'sq' ? stored : 'sq';
  } catch {
    return 'sq';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readStoredLang);

  const setLanguage = useCallback((next) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable (private mode, disabled storage) —
      // the language just won't persist across sessions.
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === 'sq' ? 'en' : 'sq');
  }, [lang, setLanguage]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(
    () => ({ lang, setLanguage, toggleLanguage, t }),
    [lang, setLanguage, toggleLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
