"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type DictKey } from "./dict";

export type Locale = "es" | "en";

/** Dict key bases that have `.one` and `.other` plural forms, e.g. "landing.projectsPublished". */
export type PluralBase = {
  [K in DictKey]: K extends `${infer B}.other` ? (`${B}.one` extends DictKey ? B : never) : never;
}[DictKey];

const pluralRules: Record<Locale, Intl.PluralRules> = {
  es: new Intl.PluralRules("es"),
  en: new Intl.PluralRules("en"),
};

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey) => string;
  /**
   * Plural-aware lookup: reads `${base}.one` or `${base}.other` via Intl.PluralRules.
   * A `{n}` placeholder in the string is replaced with the locale-formatted count.
   */
  tn: (base: PluralBase, count: number) => string;
  /** Pick the right side of a bilingual DB pair, e.g. pick(p.titleEs, p.titleEn) */
  pick: (es: string | undefined, en: string | undefined) => string;
};

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = "impacto.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  // Spanish-first.
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Hydrate from localStorage after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "es" || saved === "en") setLocaleState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback((key: DictKey) => dict[key]?.[locale] ?? key, [locale]);
  const tn = useCallback(
    (base: PluralBase, count: number) => {
      const form = pluralRules[locale].select(count) === "one" ? "one" : "other";
      const key = `${base}.${form}` as DictKey;
      const str = dict[key]?.[locale] ?? key;
      return str.replace("{n}", count.toLocaleString(locale === "es" ? "es-PR" : "en-US"));
    },
    [locale],
  );
  const pick = useCallback(
    (es: string | undefined, en: string | undefined) => (locale === "es" ? es || en : en || es) ?? "",
    [locale],
  );

  return <Ctx.Provider value={{ locale, setLocale, t, tn, pick }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
