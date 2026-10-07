# Clepsy docs animations

Looping GIFs for the docs page, one per sidebar section, rendered with
[Remotion](https://www.remotion.dev). A separate npm project from the app on purpose — Remotion
bundles with its own rspack setup, and none of this ships in the Next build.

```bash
npm i            # once, inside video/
npm run dev      # Remotion Studio on http://localhost:3100 (3000 is the app's own dev server)
npm run gifs     # renders every section into ../public/docs/*.gif
```

Single sections: `npm run gifs -- RunTimer History` (composition ids). Indonesian: `npm run gifs:id`
renders into `../public/docs/id/` — the docs page doesn't use those yet; it shows the English GIFs in
both locales.

## How it stays in sync with the app

- **Real primitives.** Scenes import `@/components/ui/*` (Button, Card, Input, Tabs…) and pure
  helpers like `@/lib/timer/model`'s `formatDuration` straight from `../src`, styled by the app's own
  `src/app/globals.css` — restyle a button in the app and the next render follows.
  `remotion.config.ts` aliases `@` to `../src` and pins React to this project's copy, so files under
  `../src` never pull in a second React.
- **Real copy.** Every string comes from `messages/en.json` / `id.json` via `src/lib/i18n.ts`. The
  only local copy is the Overview's device captions, which have no app equivalent.
- **Hand-mirrored surfaces.** Components that need Next or next-intl at runtime (sidebar, navbar,
  operator panel, agenda rows, the screen) are re-rendered as static markup in
  `src/components/app/`, using the same class strings as the originals. Each one's doc comment names
  the file it mirrors — **update the mirror when that file's markup changes**.
- **Cursor targets are measured, not hard-coded.** `<Cursor>` takes refs and finds each control's
  live position every frame, so layout changes don't leave it clicking empty space.

## Adding a section

1. Add `src/scenes/<Name>.tsx` — `Stage` → `BrowserFrame` → `Screen` with one `<Page>` per route
   (all mounted, cross-faded by opacity) and a `<Cursor>` overlay.
2. Register it in `src/Root.tsx`, add its id → slug to `scripts/render-gifs.mjs`, and add the section
   (same slug) to the app's `src/lib/docs/sections.ts` plus its copy under `docs.sections` in both
   `messages/*.json`.
3. Check frames without opening Studio:
   `npx remotion render <Id> out/frames --frames=30,90,150 --image-format=png`.

Remotion's license is free for individuals and companies of up to 3 people; larger companies need a
[company license](https://www.remotion.pro/license).
