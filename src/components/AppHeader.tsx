"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, type Role } from "@/lib/session";
import type { DictKey } from "@/lib/dict";
import { FlagBand } from "@/components/ui/tricolor";
import { startTour } from "@/components/tour/GuidedTour";
import { BrandMark } from "@/components/BrandMark";

const ROLES: Role[] = ["field_worker", "coordinator", "donor", "community"];

type NavItem = { href: string; key: DictKey };

/** Each demo role's home. The signed-in role's home is listed first and marked in the nav. */
const ROLE_HOME: Record<Role, string> = {
  field_worker: "/field",
  coordinator: "/coordinator",
  donor: "/donations",
  community: "/community",
};

const DONATE: NavItem = { href: "/donate", key: "nav.donate" };
const TRANSPARENCY: NavItem = { href: "/transparency", key: "nav.transparency" };
const COMMUNITY: NavItem = { href: "/community", key: "nav.community" };
const PLEDGES: NavItem = { href: "/donations", key: "nav.donations" };

/** Signed-out visitors see the public site (anyone can pledge without an account). */
const PUBLIC_NAV: NavItem[] = [DONATE, TRANSPARENCY, COMMUNITY, PLEDGES];

/** Each role only sees what that person actually does; staff don't pledge, neighbors don't track pledges. */
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  field_worker: [{ href: "/field", key: "nav.field" }, TRANSPARENCY, COMMUNITY],
  coordinator: [{ href: "/coordinator", key: "nav.coordinator" }, TRANSPARENCY, COMMUNITY],
  donor: [PLEDGES, DONATE, TRANSPARENCY, COMMUNITY],
  community: [COMMUNITY, TRANSPARENCY, DONATE],
};

/**
 * Two parts:
 *  1. Flag band + slim demo bar (scrolls away). Holds the demo-mode notice and the demo role
 *     switcher, so "this is synthetic" is stated once, globally.
 *  2. Main bar (sticky): wordmark, primary nav with an underline-rule active state, ES | EN.
 */
/**
 * usePathname() in the root layout must sit under <Suspense> with Cache Components on,
 * otherwise every route logs a blocking-route error.
 */
export function AppHeader() {
  return (
    <Suspense fallback={null}>
      <AppHeaderInner />
    </Suspense>
  );
}

function AppHeaderInner() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useSession();
  const pathname = usePathname() ?? "/";

  const home = user ? ROLE_HOME[user.role] : null;
  const base = user ? NAV_BY_ROLE[user.role] : PUBLIC_NAV;
  // Role home first so it's obvious where this role "lives".
  const items = home ? [...base.filter((i) => i.href === home), ...base.filter((i) => i.href !== home)] : base;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div>
        <FlagBand thickness={4} />
        {/* Fixed navy (not the flipping --navy token) so the bar reads the same in light and dark. */}
        <div className="bg-[#0b2a5b] text-white">
          <div className="mx-auto flex min-h-11 max-w-6xl items-center gap-3 px-4 text-[13px]">
            <p className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
              <span className="truncate">{t("app.demoBar")}</span>
            </p>
            <div className="ml-auto flex shrink-0 items-center gap-4">
              <button
                type="button"
                onClick={() => startTour()}
                className="flex min-h-11 items-center gap-1.5 font-semibold text-gold underline-offset-4 hover:underline"
              >
                <span aria-hidden>▶</span>
                {t("tour.open")}
              </button>
              <DemoRoleSwitcher />
            </div>
          </div>
        </div>
      </div>

      <header style={{ viewTransitionName: "site-header" }} className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-12 max-w-6xl items-stretch gap-6 px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3" aria-label={`${t("app.name")} · ${t("app.attribution")}`}>
            <BrandMark className="h-5 w-auto sm:h-7" />
            <span className="flex flex-col justify-center leading-none">
              <span className="font-display text-[1.6rem] font-normal tracking-tight sm:text-[1.85rem]">{t("app.name")}</span>
              <span className="mt-0.5 font-display text-[12px] italic text-muted">
                {t("app.attributionPrefix")} {t("app.attribution")}
              </span>
            </span>
          </Link>

          <nav aria-label={t("nav.primary")} className="hidden items-stretch gap-6 sm:flex">
            {items.map((it) => (
              <NavLink key={it.href} href={it.href} active={isActive(it.href)} home={it.href === home} homeLabel={t("nav.yourHome")}>
                {t(it.key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center">
            <LangSwitch locale={locale} setLocale={setLocale} label={t("lang.label")} />
          </div>
        </div>

        {/* Mobile nav: same links, scrollable row, 44px targets. */}
        <nav aria-label={t("nav.primary")} className="flex gap-5 overflow-x-auto border-t border-border px-4 sm:hidden">
          {items.map((it) => (
            <NavLink
              key={it.href}
              href={it.href}
              active={isActive(it.href)}
              home={it.href === home}
              homeLabel={t("nav.yourHome")}
              mobile
            >
              {t(it.key)}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  );
}

function NavLink({
  href,
  active,
  mobile = false,
  home = false,
  homeLabel,
  children,
}: {
  href: string;
  active: boolean;
  mobile?: boolean;
  /** This link is the signed-in role's home: gold marker + "(your home)" for screen readers. */
  home?: boolean;
  homeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex shrink-0 items-center whitespace-nowrap text-[15px] transition-colors ${
        mobile ? "min-h-11" : ""
      } ${
        active
          ? "font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-rule"
          : "text-muted hover:text-foreground"
      }`}
    >
      {home && <span aria-hidden className="mr-1.5 size-1.5 shrink-0 rotate-45 bg-gold" />}
      {children}
      {home && <span className="sr-only"> ({homeLabel})</span>}
    </Link>
  );
}

function LangSwitch({
  locale,
  setLocale,
  label,
}: {
  locale: string;
  setLocale: (l: "es" | "en") => void;
  label: string;
}) {
  const opts: { v: "es" | "en"; text: string; name: string }[] = [
    { v: "es", text: "ES", name: "Español" },
    { v: "en", text: "EN", name: "English" },
  ];
  return (
    <div role="group" aria-label={label} data-tour="lang" className="flex items-center text-[13px] font-semibold">
      {opts.map((o, i) => (
        <span key={o.v} className="flex items-center">
          {i > 0 && <span aria-hidden className="h-3.5 w-px bg-border" />}
          <button
            type="button"
            lang={o.v}
            aria-pressed={locale === o.v}
            aria-label={o.name}
            onClick={() => setLocale(o.v)}
            className={`grid min-h-11 min-w-11 place-items-center px-1 ${
              locale === o.v ? "text-foreground underline decoration-1 underline-offset-[6px]" : "text-muted hover:text-foreground"
            }`}
          >
            {o.text}
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * Demo sign-in / role switch: a disclosure whose options are plain buttons (data-role).
 * Choosing a role always lands on that role's home, and signing out returns to "/", so each
 * persona starts in its own space instead of inheriting the previous role's page.
 */
function DemoRoleSwitcher() {
  const { t } = useI18n();
  const { user, signInAs, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function chooseRole(r: Role) {
    setOpen(false);
    if (user?.role === r) {
      router.push(ROLE_HOME[r]);
      return;
    }
    setBusy(true);
    try {
      await signInAs(r);
      router.push(ROLE_HOME[r]);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      // Leave the role's page right away; the session is revoked in parallel.
      router.push("/");
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  const menu = (
    <div
      id={`${id}-menu`}
      hidden={!open}
      className="motion-pop absolute right-0 top-full z-40 w-72 max-w-[calc(100vw-2rem)] border border-rule bg-surface text-foreground shadow-[0_12px_32px_-16px_rgb(11_42_91/0.35)]"
    >
      <FlagBand thickness={3} />
      <div className="px-4 pb-2 pt-3">
        <p className="font-display text-lg italic">{t(user ? "nav.switchRole" : "nav.chooseRole")}</p>
        <p className="mt-1 text-xs leading-snug text-muted">{t("nav.roleLandsHome")}</p>
      </div>
      <ul className="border-t border-border pb-1">
        {ROLES.map((r) => {
          const current = user?.role === r;
          return (
            <li key={r}>
              <button
                type="button"
                data-role={r}
                aria-current={current ? "true" : undefined}
                onClick={() => void chooseRole(r)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[15px] hover:bg-paper focus-visible:bg-paper"
              >
                <span className={current ? "font-semibold" : undefined}>{t(`role.${r}`)}</span>
                <span className="text-xs text-muted">
                  {current ? t("nav.currentRole") : ROLE_HOME[r]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {user && (
        <div className="border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void leave();
            }}
            className="min-h-11 w-full text-left text-[15px] underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            {t("nav.signOut")}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative flex items-center gap-2" aria-busy={busy || undefined}>
      {user && (
        <>
          <span className="hidden text-white/75 sm:inline">{t("nav.viewingAs")}</span>
          <span className="font-semibold">{t(`role.${user.role}`)}</span>
          {!pathname.startsWith(ROLE_HOME[user.role]) && (
            <>
              <span aria-hidden className="text-white/50">
                ·
              </span>
              <Link
                href={ROLE_HOME[user.role]}
                className="flex min-h-11 items-center gap-1.5 font-semibold text-gold underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                {t("nav.goHome")}
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
          <span aria-hidden className="text-white/50">
            ·
          </span>
        </>
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-describedby={`${id}-hint`}
        title={t("nav.signInHint")}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 font-semibold underline decoration-1 underline-offset-4 hover:decoration-2 disabled:opacity-60"
      >
        {t(user ? "nav.switchRole" : "nav.signIn")}
        <svg viewBox="0 0 10 6" className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <span id={`${id}-hint`} className="sr-only">
        {t("nav.signInHint")}
      </span>
      {menu}
    </div>
  );
}
