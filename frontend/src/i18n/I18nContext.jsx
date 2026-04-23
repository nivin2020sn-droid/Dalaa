import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { translations, availableLanguages } from "./translations";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("salon_lang") || "ar");

  useEffect(() => {
    const conf = availableLanguages.find((l) => l.code === lang) || availableLanguages[0];
    document.documentElement.lang = conf.code;
    document.documentElement.dir = conf.dir;
    document.body.dir = conf.dir;
    localStorage.setItem("salon_lang", conf.code);
  }, [lang]);

  const setLang = useCallback((code) => {
    if (availableLanguages.some((l) => l.code === code)) setLangState(code);
  }, []);

  const t = useCallback(
    (key, fallback) => {
      const entry = translations[key];
      if (!entry) return fallback ?? key;
      return entry[lang] ?? entry.ar ?? fallback ?? key;
    },
    [lang],
  );

  const dir = availableLanguages.find((l) => l.code === lang)?.dir || "rtl";

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Defensive fallback — never crash the UI
    return { lang: "ar", setLang: () => {}, t: (_k, fb) => fb ?? _k, dir: "rtl", availableLanguages };
  }
  return ctx;
};
