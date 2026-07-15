# design-sync notes for integrity-mvp

## Repo shape

`integrity-mvp` is a Vite **application**, not a component library — `package.json` has no
`main`/`module`/`exports`/`types` fields and `vite.config.ts` has no `build.lib` config, so there
is no library `dist/` entry to bundle. This sync runs in the converter's last-resort synth-entry
mode (auto-detected when no dist entry resolves): the entry is synthesized by re-exporting
`.tsx`/`.jsx` files under `srcDir`, and the component list is derived by scanning those files for
PascalCase value exports via ts-morph. Expect weaker `.d.ts` fidelity than a real library build
would give, and expect non-component PascalCase exports (registry objects, type-only exports) to
get swept into the derived list — filter those via `componentSrcMap: null` as future builds
surface them.

User (Jacob) explicitly chose **broad scope**: all of `src/components/` (including app-chrome
like Sidebar/TopBar/CommandPalette) plus `src/shared/` and `src/components/widgets/` — not just a
narrow "reusable UI kit" subset. Pages (`src/pages/`), contexts (`src/contexts/`), chain wiring
(`src/chain/`), and services (`src/services/`) are explicitly out of scope, enforced via
`cfg.includeSrcDirs: ["src/components", "src/shared"]` (see fork #2 below) — not just
`componentSrcMap: null`, because that alone doesn't stop an out-of-scope file from being *bundled*
(see the wagmi bug below for why this distinction mattered in practice).

**Provider setup actually wired in this bundle:** `ToastProvider` (via `cfg.extraEntries` pointing
at `src/contexts/ToastContext.tsx` directly, since `contexts/` is out of `includeSrcDirs`) chained
with `MemoryRouter` (via `cfg.extraEntries: ["react-router-dom"]`) — `cfg.provider` wraps every
preview in `ToastProvider > MemoryRouter`. **Not wired, by design:** `AgentContext`'s
`AgentProvider` (real fetch to `oracle.listAgents()` at `http://localhost:8080` on mount) and
wagmi/wallet context — components reading `useAgent()` (`TopBar`'s agent selector,
`CommandPalette`'s keyboard-only open state) land on the floor card, which is expected and
documented, not a bug to chase.

## Deviations from the skill's general "don't fork these" guidance

Three forks, all declared in `cfg.libOverrides`, all additive (asset-loader / config-key /
file-scoping additions — none change the emitted output contract the app's self-check depends on):

**1. `lib/bundle.mjs`** — adds `'.ttf': 'dataurl'` to the shared esbuild loader map.
`src/components/widgets/TriMetricWidget.tsx` and `src/components/landing/TriMetricFunctions.tsx`
both `import 'katex/dist/katex.min.css'` directly; that stylesheet references raw `.ttf` fallback
fonts via `url()`, and esbuild had no loader registered for `.ttf` (only `.svg`/`.png`/`.woff`/
`.woff2`) — the whole bundle failed with 20 "No loader configured" errors, not just those
components. No `cfg.*` knob exists for esbuild's loader map. Relative import repointed to
`../../.ds-sync/lib/common.mjs`.

**2. `lib/source-kit.mjs`** — adds `cfg.includeSrcDirs` (allowlist of directories the synth-entry
walk is restricted to) and `cfg.excludeSrcFiles` (drop specific files even within an included
dir). Two real problems needed this, not one:
  - **Bundle size.** `componentSrcMap: null` only removes a name from the *component list* — it
    never stops the file from being pulled into the synthesized entry (`export * from` over the
    whole `srcDir`), so excluding pages/contexts by name alone left their files (and everything
    they import) still bundled. Concretely: `LandingPage.tsx` (a page, name-excluded) still
    imports `MermaidDiagram`, which alone pulled in `mermaid` + `cytoscape` + ~40 diagram-type
    chunks — about half of a 12.3MB bundle against a **12MB hard upload cap**. Fixed via
    `includeSrcDirs: ["src/components", "src/shared"]` (scopes the walk itself) plus
    `excludeSrcFiles: [".../MermaidDiagram.tsx"]` (drops that one file even though its directory is
    in scope) — brought the bundle to ~3.1MB.
  - **A hard crash, not just bloat.** `ConnectWalletButton.tsx` and `ClaimAgentModal.tsx` both
    import `wagmiConfig` from `src/chain/wagmi.ts`, whose module-scope `createConfig(...)` reads
    `base.id`/`baseSepolia.id`/`foundry.id` from `viem/chains`. Bundled through our synthesized
    multi-file entry, esbuild lazily-wraps those chain definitions (`__esm(...)`, a signal of a
    circular-import cycle it detected), and `wagmi.ts`'s top-level read runs before the lazy init —
    `Cannot read properties of undefined (reading 'id')`, crashing the *entire* IIFE (one shared
    module scope, so all 39 components with it) before `window.IntegrityMvp` was ever assigned.
    Confirmed via a standalone esbuild+`analyzeMetafile` probe and a direct Playwright load of the
    built bundle (stack trace pointed straight at `wagmi.ts`'s `CHAINS_BY_ID` line). Both files
    are now in `excludeSrcFiles` — they'd have landed on floor cards anyway per the provider note
    above, so nothing net-additional is lost; a real crash is strictly worse than a floor card.
  - Relative imports repointed to `../../.ds-sync/lib/{common,bundle,dts}.mjs`.

**3. `lib/common.mjs`** — adds `"excludeSrcFiles"`/`"includeSrcDirs"` to `CONFIG_KEYS` so the
strict config validator accepts fork #2's new fields. Loaded only for `package-build.mjs`'s own
top-level `loadLib('common')` pre-flight check; every other lib module still resolves its own
`./common.mjs` to the unforked original, so this doesn't change `validateConfig`'s behavior
anywhere else in the pipeline.

All three: `.design-sync/node_modules` symlinks to `../.ds-sync/node_modules` so bare imports
(`esbuild`) resolve from the fork's location — recreate on a fresh clone:
`ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`.

## Grading-pipeline limitation: frozen clock vs. mount animations

`package-capture.mjs` calls `page.clock.setFixedTime(...)` for deterministic screenshots. Two
authored previews — `ContactModal` and `RegistryExplorer` — are `framer-motion`
`AnimatePresence`/`motion.div` overlays that animate from `opacity: 0` on mount; under a frozen
clock, `requestAnimationFrame`-driven interpolation never advances, so the isolated per-story
capture screenshots them stuck at their initial (invisible) frame. This is a grading-tool artifact,
**not** a real rendering bug: `package-validate.mjs`'s render check (which does not freeze time)
screenshots both correctly, and the `.html` cards as shipped render fine in a real browser.

`cfg.overrides.<Name>.skip` is set for both (listing their story names) on the belief it would
exempt them from the grading requirement — checked `lib/emit.mjs` afterward and that field only
filters `c.storyIds`, which is populated for the **storybook** shape only; it has no effect here on
the package shape's capture/grade loop. So `package-capture.mjs` still lists both as "need grading"
every run, and they will keep doing so — left deliberately ungraded rather than force-graded, since
writing "good" against a screenshot that's actually blank (even though the real card isn't) would
be dishonest, and there's no real fix available short of a `page.clock` change inside
`package-capture.mjs` itself (which is upstream tooling, not something to fork for two components).
Treat this as the user's explicit deferral for these two, not a gap to keep chasing on re-sync.

## Dark-surface preview gotcha

The emitted card HTML hardcodes a white body background (`lib/emit.mjs`'s universal card chrome —
deliberately consistent across every synced design system, not something to fork around). Several
components here (`TriMetricWidget`, `SandboxConsole`'s result panel) use very-low-opacity white
overlays (`rgba(255,255,255,0.02)` etc.) designed to sit on the app's own dark page background
(`body { background: var(--bg-main) }` in `src/index.css`) — composed directly on the card
harness's white background, their text/borders wash out to near-invisible. Fixed by wrapping those
specific previews in an explicit `background: var(--bg-main)` container in the `.tsx` file itself
— a preview-authoring fix, not a converter or config change. Watch for this on any future authored
preview whose real component uses a translucent/low-opacity surface.

## Re-sync risks

- If a future katex/react-katex upgrade changes how its CSS references fonts (e.g. `.woff2`-only),
  the bundle.mjs fork becomes unnecessary dead weight — diff against upstream `lib/bundle.mjs`
  periodically (the skill's own re-sync guidance for forked files).
- If `viem`/`wagmi` upgrade in a way that changes `viem/chains`' internal module structure, re-test
  whether `ConnectWalletButton`/`ClaimAgentModal` still crash the bundle before assuming the
  exclusion is still necessary — it's possible a version bump resolves the underlying esbuild
  circular-import ordering issue and they could be re-included.
- The synth-entry mode re-derives the full component list from `includeSrcDirs` on every build —
  any new PascalCase export under `src/components/` or `src/shared/` (a new non-component helper,
  a new context accidentally added there) will show up as an undifferentiated "component" until
  explicitly null-excluded via `componentSrcMap`. Check the derived count against the last known
  list (currently 37) before assuming nothing needs new exclusions.
- No real library build exists, so `.d.ts` contracts for every component are weaker than a typical
  DS sync — recommend adding a `build:lib` script if this repo's components are ever meant to be
  consumed as an actual package.
- `ContactModal`/`RegistryExplorer` will always show 0 graded cells (see grading-pipeline
  limitation above) — that's expected steady-state for this repo, not a regression to fix on
  every re-sync.
