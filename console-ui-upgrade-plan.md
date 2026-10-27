# AstroDocX Crew Console — UI/UX Upgrade Roadmap v2 ("Holo HUD", design system v3)

> **Scope:** the Crew Console only (`app/`). The landing page (`landing/`) must not change.
> **Status:** direction approved 2026-10-24 from the high-fidelity mockups below. No app code written yet.
> **Where it lives:** this file and `docs/design-refs/mockups/` are git-ignored (`*plan*.md`, `docs/design-refs/`) but were force-added on the branch `feat/console-ui-v3`, so every machine gets them. All implementation work happens on that branch; `main` only changes through a PR.

---

## 0. The approved target

The mockups are the source of truth. When this document and a mockup disagree, the mockup wins; fix the document.

| Screen | Image | Source |
|---|---|---|
| Status Board, desktop 1440×900 | `docs/design-refs/mockups/shots/1-board-desktop.png` | `mockups/board.html` |
| Trends, desktop | `docs/design-refs/mockups/shots/2-trends-desktop.png` | `mockups/trends.html` |
| Alerts, desktop | `docs/design-refs/mockups/shots/3-alerts-desktop.png` | `mockups/alerts.html` |
| Status Board, phone 390×844 | `docs/design-refs/mockups/shots/4-board-phone.png` | `mockups/phone.html` |

The mockup CSS and JS are reusable starting points: `hud.css` (tokens, chamfered panel, tags, buttons, KPI cell, brackets) and `hud.js` (ECG, pleth and breathing traces, leader lines to rotating anchors). Open them with the `mockups` entry in `.claude/launch.json`, then go to `http://localhost:5190/docs/design-refs/mockups/board.html`.

**The direction in one paragraph:** the console becomes a holographic medical instrument. It runs on a near-black canvas with a faint dot grid and teal haze. Every module is a **chamfered panel** (cut top-left and bottom-right corners) with a glowing cyan edge and a **tab header**: a diamond, a mono caps title, a fading rule and right-aligned meta. Numbers are huge Space Grotesk readouts with a soft glow; labels are tracked JetBrains Mono caps. The real 3D particle body is the hero on the Board, with **glowing ringed markers and leader lines** to callout cards that follow the body as it turns. Status lights up the panel itself: an Act panel gets a red edge, red tint and a blinking tag. Navigation moves to a **top tab bar** (reference 4), and every desktop screen fits **one 1440×900 viewport** with no page scroll.

**What changed from roadmap v1 (rejected):**
- Soft hairline cards with small radii → chamfered glowing HUD panels.
- Left icon rail → top tab bar with a glowing underline; phones keep bottom tabs.
- "Glow only for live data" → glow is part of the identity: panel edges, readouts, traces, status tags and the hologram. It stays off body text.
- Live vitals in a compact list → instrument readouts: a 60px heart rate with a scrolling ECG, plus SpO₂ and breathing tiles with traces.
- The Board scrolled at 1440×900 → it fits one screen.
- Trends chip cloud → a channel list with per-metric sparklines, a ring gauge with a status word, a body-region panel and small multiples.

Still true from v1: no new npm dependencies; routes, stores, engine, Dexie schema, sync and PWA untouched; strict colour roles; reduced motion respected; no invented data.

---

## 1. Project audit (unchanged findings, short form)

**Stack:** React 19, Vite 8, TS 6, react-router 7 (7 routes, Board eager and the rest lazy with idle preload), zustand stores, Dexie/IndexedDB, Recharts (Trends chunk only), lucide-react, vite-plugin-pwa, Vitest + Testing Library (role-based; only `.ld-burst` and `.sr-only` are class selectors), oxlint.

**Styling today:** one 760-line `src/index.css`.

**Debt to remove:**
- No spacing or type scale (about 60 font sizes), and 9 breakpoints.
- Duplicate selectors: `.chip` 3×, `.readiness` 2×, plus overrides spread across sections.
- 28 inline `style={{ margin: 0 }}`.
- Legacy tokens: `--violet` is used for the Trends band, and `--cyan` is referenced but undefined.
- `.tile h2 { order: 3 }` reorders the DOM visually.

**UX problems the new design fixes:**
- The Board scrolls at 1440×900.
- The Next Action card is half empty.
- There's no visible h1 on the Board.
- The top bar holds 8 competing controls.
- The orange rail block is the loudest thing on screen.
- Trends' chip cloud is 330px tall.
- Sim, Sync and Ground are text stacks.
- The loading state is a plain paragraph.

**Keep as is (logic):** `engine/*`, `data/*`, every `store.ts`, `sync/{transport,outbox,link,exportLog}`, `sim/{advance,feed,demoRun}`, `live/{telemetry,heartbeat,waves,useLiveTelemetry,usePaused}`, `board/{snapshot,anatomy,hooks,mini}`, `shell/{lazyPage,install,backdrop*}`, `vite.config.ts`, the PWA manifest and env names.

**Already right and reused:** `board/body3d.ts` is a WebGL point cloud of the same baked body, with per-hazard status uniforms (`uS0…uS4`), a heartbeat (`uBeat`), a focus value (`uFocus`) and a rotation angle (`uAng`). The hologram in the mockups is this renderer restyled. **No new 3D work is needed beyond a scan line and moving leader lines.**

---

## 2. Reference → design decisions (final)

| Reference | What we took | Where it shows |
|---|---|---|
| 1 · Bio Diagnostic HUD | Chamfered panels with tab labels, corner brackets, ruler ticks beside the body bay, big BPM readout over an ECG, crew ID card with a hexagon portrait, a status bar along the bottom | Every panel, Board left column, heart-rate panel, footer |
| 2 · AI Diagnostics monitor | Glowing translucent body with ringed organ markers, histograms with glowing bars, ring KPI gauges | Twin markers, hazard mini charts, Alerts bar chart, Trends gauge |
| 3 · Health record Trend | Metric list beside the body with the selected row marked `›››`, a big ring gauge with a status word ("IN BAND"), a highlighted body region, crosshair tooltip bubbles, floor rings under the body | Trends layout, twin floor rings |
| 4 · CRETAX Genome Map | Top tab navigation with a lit active tab, a 3D hero in the centre with callouts carrying rectangular status tags, a 2×2 KPI grid, panel header pattern, a stacked right column | Top bar, Board hero, readiness KPIs, Alerts columns |

**Conflicts, resolved:**
- **Gold secondary (reference 2) vs amber Watch:** gold is not used. The comparison series is periwinkle `#8b9cff` (crew median), and orange stays for primary actions only.
- **Live sky backdrop vs flat black references:** keep the live sky (owner preference). Panels are 78% opaque and the dot grid + vignette overlay sits on top, so the sky reads as depth behind the instrument. The "Still" backdrop gives the exact mockup look.
- **Reference 1's density:** the density is kept, but every label is ≥ 11px and body text is ≥ 13px.

---

## 3. Design system v3 "Holo HUD"

### 3.1 Tokens (copy from `mockups/hud.css` into `src/styles/tokens.css`)
```css
--bg: #02050a;
--panel: rgba(5, 14, 22, 0.78);  --panel-hi: rgba(8, 22, 32, 0.9);
--edge: rgba(70, 225, 245, 0.22); --edge-hi: rgba(70, 225, 245, 0.55);      /* panel border gradient stops */
--cy: #36e2f5; --cy-hi: #9ff4ff; --cy-soft: rgba(54,226,245,.12); --cy-glow: rgba(54,226,245,.55);  /* data, nav, focus */
--or: #ff8a3d; --or-hi: #ffb27a; --or-soft: rgba(255,138,61,.14);                                    /* primary actions only */
--data-2: #8b9cff;                                                                                    /* comparison series only */
--ok: #3ddc97; --watch: #ffc53d; --act: #ff4d6a;                                                      /* status only */
--t1: #eef8ff; --t2: rgba(214,238,250,.78); --t3: rgba(170,214,232,.58); --t4: rgba(150,200,220,.32); /* t4: ticks only */
--cut: 14px;                      /* chamfer; 10px on phones, 6px on micro tiles */
--mono: 'JetBrains Mono'; --disp: 'Space Grotesk'; --ui: 'Inter';
--sp-1..16: 4 8 12 16 20 24 32 40 48 64 px;
--dur-1: 120ms; --dur-2: 200ms; --dur-3: 400ms; --ease: cubic-bezier(.2,.8,.2,1);
```
Old names (`--accent`, `--data`, `--glass-*`, `--text-*`, `--r-*`) stay as aliases until Phase 10, then they're deleted.

**Colour rules** (they go in the tokens file header):
- Cyan = data, navigation state and focus.
- Orange = the one primary action per panel.
- Green/amber/red = status only.
- Periwinkle = "compared with".
- Glow is allowed on panel edges, readouts, traces, tags, the hologram and the active tab. It's never applied to paragraphs.

### 3.2 Type scale
| Role | Spec | Mockup example |
|---|---|---|
| Eyebrow / panel title | Mono 11px, 600, uppercase, +0.16em, `--cy` in headers or `--t3` elsewhere | `READINESS`, `HEALTH TWIN // PILOT` |
| Meta | Mono 11px, +0.08em, `--t3` | `SIM · BASE 62`, `D27 07:00 MET` |
| Page or entity title | Space Grotesk 30–34px, 600, −0.02em | "Pilot", "Heart rate", "Sleep last night" |
| Card title | Space Grotesk 19–22px, 600 | Next action title |
| Hero readout | Space Grotesk 58–72px, 600, −0.04em, cyan text-shadow | 83%, 58 BPM, 59 |
| Readout L / M | Space Grotesk 30 / 22px, 600 | Hazard values, KPI values |
| Unit | Mono 12px, uppercase, `--t3` | BPM, µSV/H |
| Body | Inter 14–16px, `--t2`; emphasis `--t1` 600 | Alert explanation |
| Support | Inter 12–13px, `--t3` | "Dose rate · cumulative 7 d" |
| Tag / button | Mono 11–12px, 700, +0.12–0.14em, uppercase | `ACT`, `OPEN ACTION CARD →` |

### 3.3 Layout and breakpoints
- `xs < 480` · `sm 480–767` · `md 768–1023` · `lg 1024–1279` · `xl ≥ 1280` (desktop mockups). The 9 old breakpoints are replaced by these.
- **Desktop shell (≥1024):** a 58px top bar, `main` filling the remaining height, and a 28px status bar. At ≥1280 with a height ≥ 820, **Board, Trends and Alerts are fixed-height dashboards** (`height: 100dvh`, grid rows with `minmax(0,1fr)`, and panels scroll internally where content can grow, such as the alert queue). Below that height or width, they fall back to normal page scroll.
- `main` padding is 14px 18px, gaps are 14px, and the max width is 1760px (centred on wider screens).
- **Phone shell (<768):** a two-row top bar, scrolling content and 64px bottom tabs (as in mockup 4).

### 3.4 CSS architecture (no framework)
```
src/styles/
  index.css   → @layer tokens, base, layout, components, pages, utilities
  tokens.css · base.css (fonts, reset, focus, reduced-motion net, stage dot-grid + vignette)
  layout.css  (top bar, status bar, bottom tabs, page grids)
  components/ hud-panel.css  tag.css  button.css  kpi.css  readout.css  gauge.css  seg.css
              chip-callout.css  list-row.css  field.css  switch.css  table.css  timeline.css  state.css  menu.css
  pages/      board.css  twin.css  trends.css  alerts.css  checkin.css  sim.css  sync.css  ground.css
```

### 3.5 Components (each one exists in a mockup)
| Component | Spec (from `hud.css` and the mockups) | Implementation notes |
|---|---|---|
| **HudPanel** (`ui/HudPanel.tsx`) | Chamfered via `clip-path` on two layers: the outer layer is the edge gradient (`--edge-hi`→`--edge`), and `::before` 1px in is the fill (`--panel` + a 6% cyan top sheen). Variants: `tone="act"` (red edge + red tint), `hero` (adds corner brackets + rulers), `flat`. Header = `PanelHeader`. | `clip-path` clips outlines and box-shadows, so **focus rings go inside** (inset 2px cyan) for focusable panels and their children, and glows use `filter: drop-shadow` on the inner elements. The `<section>` keeps `aria-label`/heading. |
| **PanelHeader** | Diamond dot + mono eyebrow (cyan) + fading rule + meta | Its title is the panel's `h2` (visually the eyebrow), so screen readers still get a heading outline. |
| **Brackets / Ruler** | 18px L-shaped corners, 2px cyan with drop-shadow; vertical tick rulers beside the hero bays | `aria-hidden`, `pointer-events: none`; on hero panels only (Twin, Trends focus, Alert detail). |
| **StatusTag** | Rectangle, 1px currentColor, 14% fill, a 5px square lamp, mono caps, text glow; the Act lamp blinks | `StatusPill` stays as an alias; the word is always present (not colour-only); the blink stops under reduced motion. |
| **Button** | Primary: orange gradient, chamfered, mono caps, orange glow. Ghost: cyan 8% fill + inner 1px edge. Heights 38/42/46. | One primary per panel. Disabled = 0.42 opacity with no glow; busy = `aria-busy` + spinner. |
| **KpiCell** | Dark cyan 5% fill, 1px edge, corner tick top-left, eyebrow label, 18–22px readout | Readiness 2×2 grid, Trends stats, Sync and Ground readouts. |
| **Readout** | Value (hero/L/M) + unit + optional σ delta + optional baseline meta | Vitals, hazard modules, chip callouts. |
| **Gauge** | `dial` (250° arc, 41 ticks, cyan gradient arc with glow, value + tag in the centre) and `ring` (360°, minor/major ticks, status word box under the value) | It replaces `Dial.tsx`, the alert `Progress` and `ld-ring`; `ReadinessRing` is re-exported as a wrapper. |
| **Segmented** | Bordered strip; active = cyan 14% fill + inner edge + glow. The Alerts variant stacks the count above the label. | `aria-pressed` buttons (same as today). |
| **TwinCallout** | Chamfered chip (`--st` edge + inner glow): mono name + tag, Readout M with unit and σ, optional 1-line sub | It's still a link to `#hz-X` with the existing hover/focus coupling (`setFocusHazard`). |
| **ChannelRow** (Trends) | Name + 64×18 sparkline + latest value; a status dot when Watch/Act; selected = cyan gradient, a 2px glowing bar and `›››` | A button with `aria-pressed`; sparklines are SVG from the existing `series`. |
| **QueueRow** (Alerts) | 3px glowing status edge, hazard code box, title, mono "OPENED … MET", tag, chevron; selected = status tint + glow | A button with `aria-current`. |
| **Trace** | Canvas ECG (beat-driven), pleth and breathing waves with glow, on a 16px grid | **Reuse `live/LiveWave.tsx` and `waves.ts`** (already beat-synced); restyle only. |
| **StatusBar** | 28px mono footer: link lamp + state on the left, "MET · Prototype, not a medical device." on the right | Existing data only. |
| **StateView** | Loading (scan bar with the real boot %), empty, error (Act-tone panel) | It replaces the plain `<p class="glass">` states. |
| **Field / Switch / Table / Timeline / Menu** | Same visual language: 1px edge, mono labels, cyan focus; timeline nodes are glowing diamonds (as in the Alerts mockup) | For Check-in, Sim, Sync and Ground. |

### 3.6 Motion budget
| Effect | Where | Reduced motion / hidden tab |
|---|---|---|
| Body rotation ±30° sway, heartbeat, artery pulse | Twin (existing shader) | Static front view (existing `useReducedMotion` / `useHidden`) |
| Scan line sweep (≈5.5 s) | Twin, phone twin | Off |
| Marker ping ring on Watch/Act anchors | Twin | Static ring |
| Floor ring dash rotation (12 s) | Twin | Off |
| ECG / pleth / breathing traces | Vitals | A static trace (existing `usePaused`) |
| Act tag lamp blink, heart icon beat | Tags, HR panel | Off |
| Panel entrance (`rise`, 0.4 s) | Page load | Off |

There's one looping effect per panel at most, apart from the twin bay.

---

## 4. Screen specs (match the mockups)

### 4.1 Shell — top bar (all desktop screens)
Left to right (`board.html` header):
1. **Brand:** an octagonal cyan logo + `ASTRODOCX` / `CREW CONSOLE`.
2. **Tabs:** Board · Alerts (red count badge) · Trends · Check-in │ Simulator · Sync · Ground. The active tab has cyan text with a glow, a gradient fill and a 2px glowing underline. There's an icon + label per tab, from `ROUTES` (add `group: 'crew' | 'mission'` for the divider). They're `NavLink`s, so routes are unchanged.
3. **Mission strip:** `MET D29 23:00` │ link lamp + `LINK · 1H 00M` │ `3 QUEUED`. It's one bordered segmented readout and a link to `/sync`.
4. **Crew switcher:** round avatars with status rings; the selected one is filled with its status colour.
5. **Bell** with a count, then a `⋯` overflow menu (Run demo, Backdrop, Install, Back to landing).

**Run demo** stays reachable in one click inside the overflow. If you want it always visible, it goes before the bell as a ghost button (decide in Phase 3 review).

At `md` (768–1023): tab labels collapse to icons + tooltips (accessible names kept), and the strip shows MET + lamp only.

**Phone (`phone.html`):** row 1 is logo, page eyebrow, greeting and MET. Row 2 is the avatars, a link chip and `⋯`. Bottom tabs: Board, Alerts (badge), Trends, Check, More; the active tab gets a top glowing bar and a gradient. The More sheet becomes a dialog with focus management.

**Status bar:** see §3.5.

### 4.2 Status Board (mockup 1)
Grid `318px | 1fr | 352px` × rows `1fr | 176px`, fitting 1440×900:
- **Left column**
  - **Crew ID panel:** hexagon portrait outlined in the status colour, `CREW 04 · PILOT` eyebrow, name as the **visible h1**, and an `ACT · 3 ALERTS` tag. (The crew number is the crew index; the role comes from `snap.crew`.)
  - **Readiness panel:** dial gauge (value, status tag), then "HELD BACK BY ISOLATION", then the KPI 2×2 (7-day range, active alerts, last check-in "NONE · DUE", worst hazard), then the 7-day readiness bars. Data comes from `snap`, `mini.readiness`, `mini.lastCheckIn` and `heldBy()`.
- **Centre — Twin bay** (hero panel, brackets, rulers):
  - Header `HEALTH TWIN // PILOT` with meta `LIVE · 24,000 PT SCAN · HR 59`.
  - The WebGL body (`body3d`) with floor rings, plus a **new scan-line uniform** and **leader lines that track the rotation**. Each frame, project the 5 anchors in JS with the same angle the shader gets and write the SVG `<line>`/`<circle>` endpoints through refs. That's no React re-render, the same pattern as `useBeatAnimation`.
  - Five **TwinCallouts**: Isolation and Radiation on the left; Environment, Distance and Gravity on the right. Each shows its tile's value, unit, σ and status, and stays linked to its hazard module.
  - Bottom bar: `ROTATE · DRAG` (only if drag-rotate is added; otherwise drop it), the Act hotspot hint, `OWN BASELINE · 14 D`.
  - The existing `useAlertPulse` spark keeps flying to Next Action.
- **Right column**
  - **Heart rate panel:** 60px readout, beating heart icon, BPM + delta vs baseline, ECG trace.
  - **SpO₂ and Resp tiles:** readout, baseline, trace. All three come from the existing `useLiveTelemetry` / `LiveVitals` and keep the `SIM` meta and the `aria-live` summary.
  - **Next action** (`tone="act"` when the top alert is Act): title + tag, the 3 steps with the current one highlighted (the first is a real checkbox, as today), `0 / 3 DONE`, and the primary `OPEN ACTION CARD →`. The nominal state uses a cyan tone with "Nothing needs doing" + `DAILY CHECK-IN` (ghost).
- **Bottom row:** 5 hazard modules (code box, name, tag, Readout L + unit + σ, label, mini chart). The charts:
  - Radiation: cumulative area.
  - Isolation: 14 bars, with nights outside the band in red and a dashed baseline.
  - Distance: backlog bar with Watch/Act markers.
  - Gravity: 7 bars.
  - Environment: CO₂ line under a dashed limit.

  These come from the existing `MiniCharts` + `mini.ts` data, restyled with glow. An Act module gets the red panel tone.
- **lg (1024–1279):** the left column narrows to 280px and the right column to 320px; the hazard row becomes 3 + 2 on two rows, and the page scrolls.
- **md:** twin full width (min-height 480), then left and right columns side by side, then hazards 2-up.
- **Phone:** see mockup 4.
  - Twin (270px) beside the readiness gauge + "held back / check-in" card.
  - 3 vitals tiles.
  - 5 micro hazard tiles (code, value, status).
  - Next action with a full-width button.
  - Callouts become code chips (`I · ACT`, `E`, `R`, `G`), whose accessible names keep the full hazard name and status.

### 4.3 Trends (mockup 2)
Grid `300px | 1fr | 300px` × rows `1fr | 168px`:
- **Biometric channels:** grouped by hazard (code box + eyebrow), each row a ChannelRow with a sparkline and latest value; Watch/Act rows get a coloured dot and value. The data is the existing `series` / latest values for all 12 metrics.
- **Trend focus** (hero): eyebrow `TREND FOCUS // G · GRAVITY`, meta `OWN BASELINE ± 1.8σ = WATCH BAND`, h1 metric name + unit, the range Segmented, and a legend row (Pilot, crew median, band, alert).
- **Chart** (Recharts, restyled):
  - cyan glowing line + gradient area;
  - cyan band with dashed edges (no more violet);
  - periwinkle dashed crew median when "Compare" is on (the compare toggle moves into the legend as a toggle chip);
  - glowing amber/red alert rings;
  - a custom crosshair cursor + chamfered tooltip (value, unit, σ, MET);
  - a "NOW" label on the last point;
  - mono axes in `--t3`.

  The line stays linear (honest spikes).
- **Latest (right):** ring gauge with the value + unit + **status word** (IN BAND / ABOVE BAND / BELOW BAND, from the existing band logic). The KPI 2×2 shows Mean, Baseline (with sd), From base (σ) and Outside band %. These are the current `Stat` values.
- **Body region panel:** a second `twinRenderer` (from `body3d`, lower point size) with the focused metric's hazard region lit through `setStatus`/focus and one callout. If the GPU budget is a concern, it falls back to `drawMiniBody` (the static 2D body Ground already uses) tinted by the hazard status.
- **Small multiples (bottom row):** 6 tiles. The highest-priority metrics are shown: Watch/Act first, then the focused hazard's siblings. Each has an eyebrow, tag, Readout and a sparkline over a band strip. The full 12-metric grid stays reachable through the channel list, so nothing is removed.
- **md and below:** the channel list becomes a horizontal scroll of chips grouped by hazard (`<select>` fallback at xs); the gauge and stats sit above the chart; the multiples go 2-up.

### 4.4 Alerts (mockup 3)
Grid `330px | 1fr | 340px`:
- **Alert queue:**
  - eyebrow `ALERT QUEUE // PILOT` with meta `MOST URGENT FIRST`;
  - a 4-up Segmented with counts (Active, Act, Watch, Resolved), the same filters as today;
  - QueueRows (the selected row gets a red tint and glow);
  - a "Resolved" sub-header with compact rows (hazard code · metric, `PEAK WATCH · D23 10:00`). It shows when the Active filter is on, and the full list shows when the Resolved filter is on.
  - The panel scrolls internally.
- **Detail** (hero, `tone` = alert status, brackets in the status colour):
  - header: chamfered hazard icon box, eyebrow `I · ISOLATION · OPENED D27 07:00 MET`, title as h1, and a large tag;
  - "why": a σ readout box (`3.4σ · WHEN IT OPENED`) beside the explanation text, with the numbers bolded;
  - the **metric chart for the alert window**, a bar chart with the baseline band and dashed baseline (bars outside the band in the status colour) and a trigger label. It uses the series the detail view already loads (`alerts/detail.ts`).
  - Evidence: source tag (`NASA NTRS`, `NASA OSDR`), title link, id + why. The "Context, not a diagnosis" meta stays.
- **Right column:**
  - **Action card:** ring progress `0/3 STEPS DONE`, numbered steps (the current one in the status colour; they're real checkboxes, keeping the `fieldset`/`label` semantics), the primary `MARK DONE` (same handler), and the engine note.
  - **Timeline:** glowing diamond nodes coloured by event kind, with MET on the right.
- **Below 900px:** list → detail with a Back button (existing behaviour); the action card and timeline stack under the detail.

### 4.5 Check-in (no mockup yet: make one first in Phase 7)
- A procedure layout: a left vertical stepper panel (numbered diamonds, done = green, current = cyan glow) and a right question panel with the hero treatment.
- Scale answers are 112px chamfered option tiles (icon, number, word), with the selected tile cyan-lit.
- Symptoms are toggle chips.
- The reaction-time pad becomes a circular lamp instrument (idle = cyan ring, wait = red lamp, go = green lamp, result = hero readout in ms).
- Done = a summary panel with the next steps and actions (destinations unchanged).

### 4.6 Simulator (mockup first in Phase 8)
- The PageHeader gets the **mission clock as a hero readout**.
- Scenarios are module panels (icon box, title, mono duration, affected-metric tags, crew field, primary `INJECT`).
- "Running now" uses QueueRow-style rows with an `END NOW` ghost button.
- Time controls are a transport strip (Segmented +6 h / +24 h / … over a progress track with the busy shimmer).
- The event feed is a terminal-style panel: mono rows, status edge, newest first, internal scroll, `aria-live` unchanged.
- Reset is a red-edged danger panel.

### 4.7 Ground Sync + Ground View (mockups first in Phase 9)
- **Sync:**
  - the LinkDiagram hero inside a hero panel (keep the SVG; re-skin the stroke and glow; keep the `.ld-burst` class);
  - a ring gauge for the window;
  - KpiCells: next window, queued, last sync, station;
  - controls: `SYNC NOW` primary, Switches for blackout and auto-sync, `DOWNLOAD LOG (CSV)` ghost;
  - the outbox as packet rows with a cyan edge;
  - the log table with a sticky mono header and hairline rows.
- **Ground:** the PageHeader shows an amber "hours behind" readout when stale. Crew "profile bays" sit 4-up: a mini twin, hexagon portrait, tag, alert rows, last check-in readout and an "awaiting downlink" amber tag.

### 4.8 Loading, empty and error states
- **Boot:** a centred hero panel with a scan bar driven by the real `boot.done / boot.total`, labelled `INITIALIZING DEMO MISSION DATA · 42%`.
- **Empty:** a cyan diamond + one line + an optional action.
- **Error:** an Act-tone panel with the message, `TRY AGAIN` and `RESET DEMO DATA` (the ErrorBoundary logic is unchanged).

---

## 5. Phased implementation

Each phase ends with:
- `npm --prefix app run lint && npm --prefix app test && npm --prefix app run build`;
- a `console-preview` check at 390, 768, 1024, 1440 and 1920 wide, comparing against the mockup PNG for that screen;
- console and network clean;
- one commit.

| Phase | Work | Exit check | Est. |
|---|---|---|---|
| 0 | Branch `feat/console-ui-v3`; baseline screenshots of all 7 routes into `docs/design-refs/baseline/`; record lint/test/build | All green, baseline saved | ½ d |
| 1 | Split `index.css` into `src/styles/*` (pure move, commit), then add the v3 tokens + aliases, stage dot grid/vignette, remove the duplicate selectors, the 28 inline styles and `order:3`, and consolidate breakpoints | Pixel-close to baseline apart from the background; tests green | 1 d |
| 2 | `src/ui/`: HudPanel, PanelHeader, Brackets, StatusTag (+ alias), Button classes, KpiCell, Readout, Gauge (dial/ring), Segmented, StateView, Switch. Unit + a11y tests | Primitives render; ErrorBoundary and Suspense use StateView | 1½ d |
| 3 | Shell: top tab bar (+ `group` on `ROUTES`), mission strip, overflow menu, crew switcher restyle, status bar, phone top bar + bottom tabs + More dialog; rail removed | Every route reachable by mouse, keyboard and touch; `Chrome`/`shell` tests green | 1½ d |
| 4 | Board per §4.2 incl. scan-line uniform, rotating leader lines, LiveWave restyle, hazard modules, one-screen grid | Matches mockups 1 and 4; no page scroll at 1440×900; `StatusBoard`/`snapshot` tests green | 2½ d |
| 5 | Alerts per §4.4 incl. alert-window bar chart | Matches mockup 3; Alerts tests green | 1½ d |
| 6 | Trends per §4.3 incl. channel list, ring gauge + status word, body-region twin, Recharts restyle + custom tooltip, small multiples | Matches mockup 2; Trends tests green; Recharts still lazy | 2½ d |
| 7 | Check-in: mockup first (`mockups/checkin.html` + PNG, quick approval), then build §4.5 | Approved mockup matched; Check-in + PVT tests green | 1½ d |
| 8 | Simulator: mockup, then §4.6 | Same | 1½ d |
| 9 | Sync + Ground: mockups, then §4.7 | Same; `.ld-burst` intact | 2 d |
| 10 | Remove the aliases and legacy CSS; responsive and a11y pass (§6–7); performance pass (§8); refresh `docs/screenshots/console-*.jpg` for the README | All acceptance criteria (§9) met | 1½ d |

**Total ≈ 18 working days.** Phases 4–6 are the highest value; if time is short, ship 0–6 and keep Check-in/Sim/Sync/Ground on the v3 tokens + HudPanel only (they'll look consistent, just less bespoke).

---

## 6. Responsive matrix
| Width | Shell | Board | Trends | Alerts |
|---|---|---|---|---|
| 320–430 | 2-row top bar, bottom tabs | Mockup 4 stack | Chips row + gauge + chart (260px) + multiples 2-up | List → detail → action card |
| 768–1023 | Top bar, icon-only tabs | Twin full width, then 2-col, scrolls | Chips + chart + right column below | List → detail |
| 1024–1279 | Full top bar | 3 col narrowed, hazards 3+2, scrolls | 3 col narrowed, scrolls | 3 col narrowed |
| ≥1280 & h ≥ 820 | Full | **One screen** (mockup 1) | **One screen** (mockup 2) | **One screen** (mockup 3) |
| ≥1600 | Centred at max 1760 | Larger twin, same layout | Same | Same |

At each width, check:
- no horizontal page scroll;
- callouts never overlap the body's head or each other;
- touch targets ≥ 44px on phones;
- text ≥ 11px;
- no layout jump when the crew switcher mounts.

## 7. Accessibility
- **Contrast:** check `--t2`/`--t3` on `--panel` over the brightest backdrop frame (≥ 4.5:1 for text; `--t4` is decorative only), and tag text on its 14% fill. Glow never carries meaning on its own.
- **Focus:** the clip-path panels clip outlines, so every focusable element inside uses `outline-offset: -2px` (inset) or a 2px cyan box-shadow ring inside its own box. Test by tabbing every screen.
- **Headings:** one visible h1 per page (crew name on Board, metric on Trends, alert title on Alerts); panel headers are h2.
- **Names:**
  - icon-only tabs at md, phone callout codes and the bell/overflow keep explicit accessible names;
  - tags always contain the word;
  - charts keep text alternatives (Trends stats `dl`, alert explanation, hazard values).
- **Motion:** everything in §3.6 stops under `prefers-reduced-motion` and when the tab is hidden. The Act blink is ≤ 1 Hz with no flashing above 3 Hz.
- **Menus:** the overflow menu and More sheet get focus in and out, Esc, outside click and arrow keys. Tests are extended in `a11y.test.tsx` (one h1 per route, names on the new controls, dialog semantics).

## 8. Performance
- No new dependencies; one CSS bundle (≤ current + 20%).
- The twin stays one WebGL draw. Leader lines update via refs; there are no per-frame React renders.
- The second twin on Trends is lazy, pauses when offscreen (IntersectionObserver), and falls back to SVG on low-end devices.
- Backdrop-filter blur only on the fixed top bar and menus; panels are tinted, not blurred.
- Traces use the existing `usePaused` (they stop when hidden).
- Lighthouse mobile `/board`: performance ≥ current, a11y ≥ 95, CLS ≈ 0.

## 9. Acceptance criteria
- Board, Trends, Alerts and the phone Board visually match their mockup PNGs (layout, hierarchy, colours, glow, chamfers).
- Check-in, Simulator, Sync and Ground match their own approved mockups made in Phases 7–9.
- Board, Trends and Alerts fit 1440×900 with no page scroll; no horizontal scroll from 320 to 1920.
- Colour roles hold: orange only on primary actions, cyan on data/nav/focus, status colours only for status, periwinkle only for comparison.
- All existing functionality works: crew switch, Run demo, alert steps + Done, filters, range/metric/compare, check-in + PVT, inject/advance/reset, sync/blackout/auto/CSV, ground refresh, backdrop picker, install, landing link.
- Lint, tests and build are green; no new console errors; a11y checks in §7 pass.

## 10. Risks
| Risk | Mitigation |
|---|---|
| Glow + live sky + WebGL cost on weak laptops | Panels tinted not blurred; one twin by default; pause offscreen/hidden; "Still" backdrop |
| `clip-path` hides focus rings and shadows | Inset focus rings (§7); glows via `drop-shadow` on inner elements |
| Leader lines drift from the rotating body | Project anchors with the exact shader math (`K`, `Y_MID`, `uAng`) in one shared helper in `body3d.ts` |
| One-screen layout breaks on short laptops (1366×768) | Height-gated fixed layout (h ≥ 820), otherwise normal scroll |
| Look reads as a game, not a medical tool | Real data only, the "Prototype, not a medical device" bar on every screen, glow kept off body text |
| Remaining screens drift from the approved look | Mockup → approval → build for Phases 7–9 |

---

## Session log

### 2026-10-27: Phases 0–2

**Done (4 commits on `feat/console-ui-v3`):**
- **Phase 0** (`652ca6d`): baseline screenshots of all 7 routes at 1440×900 and 390×844 in `docs/design-refs/baseline/`, with page sizes and the lint/test/build numbers in its README.
- **Phase 1a** (`933af98`): `src/index.css` moved to `src/styles/index.css` unchanged (byte-identical CSS bundle).
- **Phase 1b** (`3557585`): v3 tokens + v2 aliases in `tokens.css`; the stylesheet split into layers and one file per screen; stage dot grid + vignette; duplicate `.chip` / `.readiness` merged; static inline styles replaced by `.flush*` utilities and classes (only computed values stay inline); `order: 3` removed by moving the tile heading in the DOM; breakpoints reduced to 480/768/1024/1280; `--cyan` replaced by `--cy`.
- **Phase 2** (`0fdd086`): `src/ui/` primitives (HudPanel + PanelHeader/Brackets/Ruler, StatusTag, Button, KpiCell/KpiGrid, Readout, Gauge dial/ring, Segmented, StateView, Switch), styles in `src/styles/components/`, 18 tests. `StatusPill` is now an alias of `StatusTag`; ErrorBoundary and the route Suspense fallback use StateView.
- Checks after each phase: lint clean, build OK, tests 190/190 after Phase 1 and 208/208 after Phase 2. Console clean on every route in the preview build.

**Left:** Phases 3–10 as planned, starting with Phase 3 (shell: top tab bar, mission strip, overflow menu, status bar, phone bars). The per-page boot/loading paragraphs (`Initializing demo mission data…`) still use the v2 glass card; the Board's boot is the natural first user of `StateView`'s `progress` (§4.8), in Phase 4.

**Decisions:**
- **Layer order is `tokens, base, components, layout, pages, utilities`** (§3.4 listed layout before components). Generic components must sit below shell and page rules, otherwise shell refinements such as `.topbar .home-btn` lose to `.btn` regardless of specificity.
- **Phase 1 was verified with a computed-style diff**, not only screenshots: every element's box and key styles on 7 routes × 4 widths, before and after. With the old token values the only difference was intended (next point).
- **The phone top bar now hides Install.** Its `display: none` had been dead since v2 (`.btn` came later), which pushed MET onto a third row. With the layers the rule applies and the bar is the documented two rows (128 px).
- **Rules that never rendered were dropped, not revived:** `.demo-btn`/`.install-btn` sizing, the phone `main` padding, phone `.chip`/`.met` overrides and the `.readiness` ≤600 px padding all lost on source order in v2.
- **Aliases:** v2 names with a v3 equivalent point at it (`--accent`→`--or`, `--data`→`--cy`, `--text-*`→`--t1..3`, `--violet`→`--data-2`). `--glass-*`, `--line*`, `--shadow`, `--r-*` keep their v2 values until Phase 10, so unconverted screens only shift in accent, data, status and text colours.
- **Breakpoints:** each old width was mapped to the nearest v3 boundary that leaves 390/768/1024/1440 unchanged (820→1024, 900→1024, 1100/1180→1280, 1100 max→1279, 600/640→767, 520→479, 899→1023).
- **`KpiGrid` takes no label:** a `<dl>` has no ARIA role, so a name on it is dropped; naming belongs to the panel around it.
- **StatusTag default words stay `NOMINAL / WATCH / ACT`** (screen text and tests use them); `short` gives the mockup's `NOM`.
- **Tests on this machine:** the full suite can time out `AlertsPage` / `SimulatorPage` under load (20k-reading seed); they pass alone. Phase 1 and 2 runs were fully green.
- **Not pushed:** `git push origin feat/console-ui-v3` returned 403 for the GitHub user `morsad01` (no write access to `A-42-018/AstroDocX`). The commits are local until someone with access pushes them.

### 2026-10-27: Phases 3–4

**Done (2 commits on `feat/console-ui-v3`, pushed):**
- **Phase 3** (`b57e4fa`): the shell. A top bar with the octagon logo and wordmark, tabs grouped crew │ mission (`ROUTES` gained `group` and a phone `mini` label) with the glowing underline and the Alerts count, a mission strip (MET │ link lamp + time │ queue) that links to Ground Sync, round crew avatars with status rings, the bell and a `⋯` menu. Phones get the two-row bar from mockup 4 and 64 px bottom tabs; the More sheet is a dialog. The 28 px status bar is on every screen. The icon rail is gone. New: `shell/Overflow.tsx`, `shell/usePopover.ts` (shared by both popovers: focus in, Escape back to the trigger, outside click, arrow keys, closes on navigation).
- **Phase 4** (`22122b3`): the Status Board per §4.2. Crew ID panel with the visible h1; the readiness dial with the KPI 2×2 and 7 bars; the twin bay with floor rings, five callouts, ringed markers and leader lines that follow the turning body, and a scan line; heart rate, SpO₂ and Resp tiles; Next Action as a tone panel; five hazard modules. Board loading, empty and error states use `StateView` with the real boot %.
- Checks after each phase: lint clean, tests 210/210, build OK. In the preview build at 390, 768, 1024, 1440 and 1920 wide: no horizontal scroll, and no page scroll at 1440×900 or 1920×1080. 1280×800 scrolls, as planned (the one-screen layout needs a height ≥ 820).

**Left:** Phases 5–10 as planned, starting with Phase 5 (Alerts per §4.4).

**Decisions:**
- **Run demo lives in the `⋯` menu.** While a demo runs (or has finished), a ghost `Demo n/8` / `Reset demo` button also shows next to the bell, so it can be stopped in one click. Install, Back to landing and the backdrop choice are in the same menu; the standalone backdrop button is gone (`BackdropPicker.tsx` now exports `BackdropChoices`).
- **Top bar compaction needs a 1440 px step.** The full mockup bar only just fits at 1440 (1430 px with a scrollbar). Below 1440 the wordmark and the word "queued" go; below 1280 the mission tabs become icons and the link time becomes the lamp; below 1024 all tabs are icons (§4.1). The 1440 query is shell-only; pages still use the §3.3 breakpoints. At 1920 the bar and status bar contents line up with the 1760 px main column.
- **Callouts collapse with a container query on the bay** (`@container bay (max-width: 560px)`), not a viewport breakpoint. The bay is only about 360 px wide at 1024 and 546 px at 1280, where full callouts overlapped each other and the head; they become `I · ACT`-style code chips there and on phones. Full callouts show at 1440 and up (and at 768, where the bay is full width).
- **Leader lines:** `body3d.ts` exports `turned(anchor, ang)` (the shader's rotY + `toBox`). The twin measures the figure and callout boxes on resize and moves the markers, lines and scan line through refs every frame; there's no React render per frame. Each line runs from the callout edge, through an 18 px knee, to the marker. Without WebGL (and in tests) the markers sit on the SVG twin's fixed spots.
- **Scan line:** a new `uScan` uniform brightens the particles within about 3% of the line's height, and an SVG line is drawn at the same height. The sweep takes 5.5 s and is off under reduced motion.
- **Crew avatars keep a small status flag for Watch/Act**, which the mockup doesn't have, so the ring colour isn't the only cue. The selected avatar is filled with its status colour, as in the mockup.
- **The Isolation chart marks nights outside the Watch band (mean ± 1.8 sd) in red.** That needed the sleep sd, so `MiniData` gained `sleepSd` (an added field; the loading logic is unchanged).
- **The bay bar's left label is "◇ Live hologram"**, since there's no drag-rotate (§4.2 said to drop `ROTATE · DRAG` in that case). Next Action's count reads `n / m done`.
- **The Distance backlog bar keeps its real 0–96 h scale**, so the Act mark sits at 75%, not at the right end as in the mockup.
- **CSS budget:** the bundle is 66.4 kB (15.0 kB gzip) against the Phase 0 baseline of 45.0 kB (10.5 kB gzip), over §8's +20%. It was already 61.2 kB after Phase 2, because the v2 rules are still there next to v3. Phase 10's legacy removal has to bring it back within budget.
- **Preview tip:** the PWA service worker serves the previous build after `npm run build`. Unregister it (DevTools → Application, or `navigator.serviceWorker.getRegistrations()`) and clear caches before checking a new build. The preview serves the app under `/app/`.
