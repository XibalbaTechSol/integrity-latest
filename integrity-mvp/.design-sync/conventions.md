## Building with this design system

This is Integrity Protocol's dashboard component set — a dark-theme network/security operations UI (agent trust scores, on-chain compliance, telemetry). It ships as plain CSS custom properties + a small set of utility classes, no CSS-in-JS, no Tailwind.

### Setup

Most components need no wrapper. Two real contexts are available if a component reads them:
- **Toast notifications**: `useToast()` needs a `ToastProvider` ancestor.
- **Routing**: components using `NavLink`/`useNavigate`/`useLocation` need a router ancestor (`MemoryRouter` for a static build).

Compose them together:
```jsx
<ToastProvider>
  <MemoryRouter>
    {/* your composition */}
  </MemoryRouter>
</ToastProvider>
```

Not available in this build: the live agent-selection context (`useAgent`, which fetches from a real backend) and wallet/wagmi context — components that depend on those (an agent-picker dropdown, connect-wallet, claim-agent flows) are out of scope here. Don't compose new work assuming a `useAgent()`-style hook exists in this bundle.

### The dark-surface gotcha

The app always renders on a dark page background (`body { background: var(--bg-main) }`). A number of components — dashboard result panels, metric tiles — use *very* low-opacity white overlays (`rgba(255,255,255,0.02)`, `rgba(255,255,255,0.05)`) as their surface, meant to sit on top of that dark shell. Composing one of these directly on a white/light background makes text and borders wash out to near-invisible. When building a layout with these pieces, wrap the region in `background: var(--bg-main)` (or nest inside a component that already sets a solid dark background, like `.card`/`.panel`) rather than placing them on a bare white canvas.

### The styling idiom: CSS custom properties + utility classes

No Tailwind, no styled-components. Colors, spacing units, and radii are HSL-based custom properties set on `:root`; layout/chrome comes from a small shared set of utility classes. Real names, not illustrative:

**Tokens** (`var(--name)`):
| Token | Use |
|---|---|
| `--bg-main`, `--bg-sidebar`, `--bg-panel`, `--bg-panel-hover` | page / chrome / card surfaces, darkest to lightest |
| `--border-color` | the one border color used everywhere |
| `--text-primary`, `--text-secondary`, `--text-muted` | white → mid-gray → dim-gray text hierarchy |
| `--accent-primary`, `--accent-hover` | the interactive blue accent (glows, links, primary buttons) |
| `--primary` | alias of `--accent-primary` — many components reference this name directly |
| `--success`, `--warning`, `--danger` | status colors (also aliased as `--status-active`/`--status-verifying`/`--status-revoked`) |
| `--gold` | a second accent used for "trust/value" numbers (AIS scores, staked amounts) — not a semantic status color |
| `--radius-sm` (6px), `--radius-md` (12px), `--radius-lg` (16px) | corner radii |
| `--font-sans`, `--font-mono` | body font (Inter by default) and monospace (JetBrains Mono, for hashes/addresses/code) |

**Utility classes**:
| Class | Use |
|---|---|
| `.card`, `.panel` + `.panel-header` | the two base surface containers — `.panel` is plainer/denser, `.card` has more shadow/radius |
| `.glass-panel` / `.glass-panel-hover` | frosted, translucent surface (dropdowns, popovers, the sidebar's user menu) |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline` | button variants — `.btn-primary` is solid accent-filled, the other two are bordered/transparent |
| `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger` | small status pills (also produced by the `StatusBadge` component, which maps status strings to these three automatically) |
| `.input-field` / `.form-input` | text input chrome |
| `.data-table` | plain bordered table (`th`/`td` styling) — `NotionDatabase` is the richer, sortable/filterable table component built on `@tanstack/react-table` |
| `.code-block` | monospace code/hash display |
| `.custom-scrollbar` | themed scrollbar for horizontally-scrolling regions |

There are three alternate themes (`[data-theme="navy-gold"]`, `[data-theme="clinical-light"]`, `[data-theme="legacy-ide"]`) that remap the same token names — components should never hardcode a color that has a token equivalent, so they keep working under all three.

### Where the truth lives

`styles.css` at the project root `@import`s the real compiled stylesheet — read it (and the token block it pulls in) before styling anything new, rather than guessing at color values.

### A representative composition

```jsx
<div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
    Agent Registry
    <StatusBadge status="certified" />
  </div>
  <button className="btn btn-primary">Register Agent</button>
</div>
```
