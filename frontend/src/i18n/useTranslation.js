import { useState, useCallback } from 'react';
import en from './en.json';
import nl from './nl.json';

const DICTIONARIES = { en, nl };
const STORAGE_KEY  = 'vaultmotion_ui_lang';

export function useTranslation() {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'nl'
  );

  const setLang = useCallback((newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang);
    setLangState(newLang);
  }, []);

  const t = useCallback((key, fallback, vars) => {
    let str = DICTIONARIES[lang]?.[key] ?? fallback ?? key;
    if (vars && str) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }
    return str;
  }, [lang]);

  return { t, lang, setLang };
}
