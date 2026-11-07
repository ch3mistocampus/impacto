"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSession, type Role } from "@/lib/session";

const ROLES: Role[] = ["field_worker", "coordinator", "donor", "community"];

export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const { user, signInAs, signOut } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="bg-amber-soft text-amber text-xs text-center py-1 px-4">{t("app.demoBanner")}</div>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="font-display text-xl font-semibold text-clay">
          {t("app.name")}
        </Link>
        <nav className="hidden sm:flex gap-4 text-sm ml-4">
          <Link href="/donate">{t("nav.donate")}</Link>
          <Link href="/transparency">{t("nav.transparency")}</Link>
          <Link href="/donations">{t("nav.donations")}</Link>
          {user?.role === "field_worker" && <Link href="/field">{t("nav.field")}</Link>}
          {user?.role === "coordinator" && <Link href="/coordinator">{t("nav.coordinator")}</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <button
              onClick={signOut}
              title={t("nav.signInHint")}
              className="text-sm px-3 py-1.5 rounded-full border border-border"
            >
              {t(`role.${user.role}`)} · {t("nav.signOut")}
            </button>
          ) : (
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                title={t("nav.signInHint")}
                className="hidden sm:inline rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber"
              >
                {t("nav.demoTag")}
              </span>
              <select
                aria-label={t("nav.signIn")}
                aria-describedby="signin-demo-hint"
                title={t("nav.signInHint")}
                className="text-sm px-2 py-1.5 rounded-full border border-border bg-surface"
                value=""
                onChange={(e) => e.target.value && signInAs(e.target.value as Role)}
              >
                <option value="">{t("nav.signIn")}</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </select>
              <span id="signin-demo-hint" className="sr-only">
                {t("nav.signInHint")}
              </span>
            </span>
          )}
          <button
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            className="text-sm px-3 py-1.5 rounded-full bg-clay text-white font-medium"
            aria-label={locale === "es" ? "Switch to English" : "Cambiar a español"}
          >
            {t("lang.toggle")}
          </button>
        </div>
      </div>
      {/* Mobile nav: same links, horizontally scrollable, large touch targets */}
      <nav className="sm:hidden border-t border-border flex gap-1 overflow-x-auto px-2 text-sm font-medium">
        <Link href="/donate" className="shrink-0 px-3 py-2.5">{t("nav.donate")}</Link>
        <Link href="/transparency" className="shrink-0 px-3 py-2.5">{t("nav.transparency")}</Link>
        <Link href="/donations" className="shrink-0 px-3 py-2.5">{t("nav.donations")}</Link>
        {user?.role === "field_worker" && <Link href="/field" className="shrink-0 px-3 py-2.5">{t("nav.field")}</Link>}
        {user?.role === "coordinator" && (
          <Link href="/coordinator" className="shrink-0 px-3 py-2.5">{t("nav.coordinator")}</Link>
        )}
      </nav>
    </header>
  );
}
