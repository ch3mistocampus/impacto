"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/dict";
import { FlagBand } from "@/components/ui/tricolor";

type Item = { name: string; href?: string; note: DictKey };
type Section = { title: DictKey; items: Item[] };

/** What the site is made with. Names are proper nouns (not translated); notes are bilingual. */
const SECTIONS: Section[] = [
  {
    title: "colophon.s.frontend",
    items: [
      { name: "Next.js 16", href: "https://nextjs.org", note: "colophon.next" },
      { name: "React 19", href: "https://react.dev", note: "colophon.react" },
      { name: "TypeScript", href: "https://www.typescriptlang.org", note: "colophon.ts" },
      { name: "Tailwind CSS 4", href: "https://tailwindcss.com", note: "colophon.tailwind" },
    ],
  },
  {
    title: "colophon.s.backend",
    items: [{ name: "Convex", href: "https://convex.dev", note: "colophon.convex" }],
  },
  {
    title: "colophon.s.ai",
    items: [
      { name: "OpenRouter", href: "https://openrouter.ai", note: "colophon.openrouter" },
      { name: "Google Gemini Flash", note: "colophon.gemini" },
    ],
  },
  {
    title: "colophon.s.hosting",
    items: [{ name: "Vercel", href: "https://vercel.com", note: "colophon.vercel" }],
  },
  {
    title: "colophon.s.type",
    items: [
      { name: "Source Serif 4", href: "https://fonts.google.com/specimen/Source+Serif+4", note: "colophon.sourceSerif" },
      { name: "Karla", href: "https://fonts.google.com/specimen/Karla", note: "colophon.karla" },
      { name: "Tricolor", note: "colophon.tricolor" },
      { name: "Material glyphs", note: "colophon.glyphs" },
    ],
  },
  {
    title: "colophon.s.tooling",
    items: [
      { name: "Claude Code", href: "https://claude.com/claude-code", note: "colophon.claude" },
      { name: "Playwright", href: "https://playwright.dev", note: "colophon.playwright" },
      { name: "pnpm", href: "https://pnpm.io", note: "colophon.pnpm" },
    ],
  },
];

export function Colophon() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl pt-6 sm:pt-10">
      <header className="border border-border bg-surface">
        <FlagBand thickness={6} />
        <div className="px-5 pt-8 pb-7 text-center sm:px-12 sm:pt-10">
          <h1 className="font-display text-[2.6rem] font-normal leading-[1.02] sm:text-6xl">{t("colophon.title")}</h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[17px] leading-relaxed text-muted">{t("colophon.lead")}</p>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.title} aria-labelledby={s.title}>
            <h2 id={s.title} className="border-b-2 border-double border-rule pb-2 font-display text-2xl font-normal">
              {t(s.title)}
            </h2>
            <dl className="divide-y divide-border">
              {s.items.map((it) => (
                <div key={it.name} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                  <dt className="font-semibold">
                    {it.href ? (
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {it.name}
                      </a>
                    ) : (
                      it.name
                    )}
                  </dt>
                  <dd className="leading-relaxed text-muted">{t(it.note)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-12 text-center font-display text-lg italic text-muted">{t("colophon.madeFor")}</p>
    </div>
  );
}
