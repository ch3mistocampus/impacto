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
  /** Display a stored (Spanish) unit in the current locale, e.g. u("bolsas") → "bags" in EN. */
  u: (unit: string | undefined) => string;
};

/** Material units are stored in Spanish in the DB; translate the common ones for display. */
const UNIT_EN: Record<string, string> = {
  unidades: "units", unidad: "unit", bolsas: "bags", bultos: "sacks", sacos: "sacks", cajas: "boxes",
  galones: "gallons", kits: "kits", libras: "pounds", metros: "meters", piezas: "pieces",
  planchas: "sheets", láminas: "sheets", rollos: "rolls", sobres: "packets", tejas: "roof tiles",
};

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = "impacto.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  // English by default; a saved choice (ES | EN toggle) wins.
  const [locale, setLocaleState] = useState<Locale>("en");

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
      return str.replace("{n}", count.toLocaleString(locale === "es" ? "es-CO" : "en-US"));
    },
    [locale],
  );
  const pick = useCallback(
    (es: string | undefined, en: string | undefined) => (locale === "es" ? es || en : en || es) ?? "",
    [locale],
  );

  const u = useCallback(
    (unit: string | undefined) => {
      if (!unit) return "";
      return locale === "en" ? (UNIT_EN[unit.trim().toLowerCase()] ?? unit) : unit;
    },
    [locale],
  );

  return <Ctx.Provider value={{ locale, setLocale, t, tn, pick, u }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
