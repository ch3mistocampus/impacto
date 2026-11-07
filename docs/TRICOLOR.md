# Tricolor — Impacto design system

Chosen direction (see `docs/design-directions-v2.html`, section "Tricolor"). The Colombian flag used with the restraint of an official document: white paper, navy ink, Bodoni display, Karla text. Credible, calm, certificate-like. Espejo de Agua is in Pijao, Quindío, Colombia.

## Source of truth
- Tokens: `src/app/globals.css` (light + dark). Tailwind classes: `bg-navy text-on-navy`, `bg-paper`, `text-muted`, `border-border`, `border-rule`, `text-gold-ink bg-gold-soft`, `text-emerald bg-emerald-soft`, `text-red bg-red-soft`, `bg-stage-received|delivered|used|verified`, `bg-stage-track`.
- Kit: `src/components/ui/tricolor.tsx` — `FlagBand`, `DoubleRule`, `Kicker`, `Seal`, `CategoryMark`, `StageSwatch`, `stageFill`, `STAGE_TEXT`, `PLEDGED_HATCH`, `btn()`, `Button`, `Chip`, `STATUS_TONE`, `inputCls`, `labelCls`, `intlLocale`.
- Material imagery: `src/components/ui/MaterialGlyph.tsx` (line drawings, `currentColor`). There are NO png assets in `public/materials` or `public/brand`; never render emoji.

## Rules
1. **Colour = ledger stage only.** requested = outline · pledged = hatched gold (`text-gold-ink`) · received/delivered/used = navy tints · verified = esmeralda (`text-emerald`), the ONLY green. Red = errors/destructive only. A safety pause is calm navy, never red.
2. **Programs by shape, not colour.** Use `<CategoryMark category=… />` (triangle / square / circle) + the label, in ink colour. Remove all per-category colour (no `text-clay/text-brick/text-leaf` for categories, no coloured top borders per bucket, no tinted category image panels).
3. **Legacy tokens** (`clay, brick, leaf, sky, amber` and their `-soft`) are temporary aliases. Migrate every usage in your files to the semantic tokens. `text-white` on a navy fill must become `text-on-navy` (dark mode flips the fill to light).
4. **Type.** `font-display` (Bodoni Moda) for headlines and large figures at `font-normal` or `font-medium` — never `font-semibold`/`font-bold` (Bodoni goes blotchy). Karla (`font-sans`) for everything else; buttons/labels `font-semibold`. Sentence case. No all-caps, no tracked eyebrows; use `<Kicker>` (italic Bodoni) above a headline when a caption is needed. Body ≥ 15px; small meta ≥ 12px.
5. **Shape.** Square corners: `rounded-[2px]` (or none). No pill buttons, no `rounded-2xl/3xl` cards, no drop shadows on cards — use hairline `border-border`, or `border-rule` + `DoubleRule` for emphasis. Phone-sheet/dialog may keep a small top radius only if needed for the bottom-sheet affordance.
6. **Flag band**: one `<FlagBand/>` at the top of a significant surface (page header area, the donor card, a report/certificate). Not on every card.
7. **Buttons**: `btn("primary")` navy, `btn("secondary")` outlined, `btn("quiet")` underlined text link, `btn("danger")`, `btn("verify")` esmeralda for coordinator verification actions. No "→" glyphs appended.
8. **Honesty copy once per screen.** "Comprometer no es entregar" appears once, where the decision is made; the ledger visual (hatched gold) carries it elsewhere. Demo labelling: the global demo bar in the header + the as-of/demo stamp on data pages; drop repeated per-card demo tags.
9. **Locale**: dates/numbers via `intlLocale(locale)` → `es-CO` / `en-US` (replace any `es-PR`).
10. **Accessibility floor**: keep every existing aria attribute, keyboard shortcut, `aria-live`, reduced-motion handling and button alternative to swipe. Contrast AA in light and dark. Touch targets ≥ 44px.
11. **Do not change** Convex functions, data flow, props contracts across lanes, dict key names (you may add keys in your lane's dict file, ES + EN), or behaviour. This is a visual/UI pass.
