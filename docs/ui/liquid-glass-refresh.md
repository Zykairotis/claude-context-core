# Liquid Glass UI Refresh

## Summary
- Modernized the cockpit UI with a Nord-inspired, liquid-glass aesthetic.
- Added a Mac-style dock navigation that mirrors section visibility and enables smooth intra-page jumps.
- Reframed content into thematically grouped glass panels while preserving existing data + API wiring.

## Source Coverage
- `src/ui/app.tsx:24-220` – Imports, dock metadata, state, refs, intersection observer.
- `src/ui/app.tsx:617-983` – Complete JSX restructure (dock scaffold, sectional layout, CTA wiring).
- `src/ui/styles/glass-styles.tsx:5-381` – Palette swap, dock/section rules, responsive behavior, component tokens.
- Documentation (`docs/ui/liquid-glass-refresh.md`) – this report.

Line references use `file:line` notation so you can jump from this doc directly to the implementation.

---

## Dock Navigation Architecture
- **Section catalog**: `DOCK_SECTIONS` (`src/ui/app.tsx:73-80`) defines six anchor points (overview → operations) with typed `LucideIcon` references to avoid prop-type conflicts.
- **State + references**:
  - `activeSection` (`src/ui/app.tsx:181`) tracks the currently highlighted dock entry.
  - `contentRef` (`src/ui/app.tsx:183`) holds the scrollable shell DOM node.
  - `sectionRefs` (`src/ui/app.tsx:184-191`) memoizes `RefObject<HTMLDivElement>` instances keyed by section id; using `React.createRef` per entry allows resilient observation even if order changes.
- **Click handling**: `handleDockSelect` (`src/ui/app.tsx:193-201`) sets `activeSection` and calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` so both pointer and keyboard activation produce the same UX.
- **Scroll awareness**:
  - `IntersectionObserver` attaches in `useEffect` (`src/ui/app.tsx:204-220`).
  - Thresholds `[0.35, 0.6]` mean a section becomes dominant after ~35% of it is onscreen; sorting intersections by ratio (`src/ui/app.tsx:212-214`) biases toward the most visible panel.
  - Cleanup disconnects the observer on unmount (`src/ui/app.tsx:220`).
- **Dock rendering**:
  - Scaffold lives at `src/ui/app.tsx:617-657`.
  - Individual buttons use `cn('dock-item', isActive && 'dock-item-active')` for class composition (`src/ui/app.tsx:637-640`); `type="button"` avoids nested form submits (`src/ui/app.tsx:636`).
  - Footer surfaces the current mode/project for quick context (`src/ui/app.tsx:649-655`).

### Interaction Flow
1. User clicks “Retrieval” → `handleDockSelect('retrieval')` updates state and smooth scrolls.
2. Observer notices the retrieval section (`data-section-id="retrieval"`) crossing the threshold → `activeSection` stays in sync if the user scrolls further manually.
3. Dock button state toggles, injecting `dock-item-active` (gradient glow + icon scale).
4. On mobile (≤1024px) the dock relocates to a floating bottom rail; the same state machinery drives the condensed icon-only buttons (`src/ui/styles/glass-styles.tsx:234-281`).

---

## Section Layout & Content
Each major area is now wrapped in a `<section>` with `data-section-id` so the observer can map DOM nodes to dock entries. Shared class `section-stack` provides consistent spacing (`src/ui/styles/glass-styles.tsx:213-221`).

### Overview (`data-section-id="overview"`)
- Hero card lives at `src/ui/app.tsx:661-682`, retaining telemetry CTAs.
- CTA “Run Hybrid Query” reuses the dock navigation path to focus the retrieval panel (`src/ui/app.tsx:684-687`).
- Metrics moved into `metrics-panel` (`src/ui/app.tsx:703-718`), a secondary glass slab with a subtle blur (`src/ui/styles/glass-styles.tsx:214-232`).

### Ingestion (`"ingest"`)
- Section header: `src/ui/app.tsx:720-733` (kicker/title/summary).
- Tabbed card merges GitHub + Crawl forms (`src/ui/app.tsx:736-810`); grid sizing inline styles remain but now sit inside the section grid.
- Recent job table unchanged functionally, now wrapped in the same card with new glass border glow.

### Retrieval (`"retrieval"`)
- Header: `src/ui/app.tsx:778-788`.
- Query form (`src/ui/app.tsx:791-822`) and results stack (`src/ui/app.tsx:824-861`) share consistent spacing via `.grid-gap`.
- Chips adopt updated accent tokens to match Nord teal + muted purple (`src/ui/styles/glass-styles.tsx:306-325`).

### Scopes (`"scopes"`)
- Header: `src/ui/app.tsx:832-842`.
- Tabs show resources per scope (`src/ui/app.tsx:845-870`); the share form remains below with fresh glass gradients (`src/ui/app.tsx:872-907`).

### Telemetry (`"telemetry"`)
- Pipeline card: `src/ui/app.tsx:911-945`; overlay highlight added via inline `style` + new Nord color in `getPhaseColor`.
- MCP tools list: `src/ui/app.tsx:947-958` — the chip styling updates keep tool names readable on the darker palette.

### Operations (`"operations"`)
- Incident stream: `src/ui/app.tsx:964-983`; data flow identical, layout inherits section spacing.

---

## Theme & Styling Enhancements
- **Nord palette**: Variables swapped in `src/ui/styles/glass-styles.tsx:5-21` for Nord blues (`--accent`), teals (`--glass-highlight`), and soft neutrals (`--muted`).
- **Background**: Multi-radial gradients + #0b1220 base create a deeper midnight backdrop (`src/ui/styles/glass-styles.tsx:34-37`).
- **Dock surface**:
  - Primary styling at `src/ui/styles/glass-styles.tsx:80-212` – sticky positioning, blurred background, gradient shimmer, hover/active transitions, icon containers.
  - `dock-item::after` introduces the sweeping highlight (`src/ui/styles-glass-styles.tsx:176-184`).
- **Section scaffolding**:
  - `.section-header` for kicker/title/summary alignment (`src/ui/styles/glass-styles.tsx:222-233`).
  - `.section-grid` ensures cards maintain a minimum 340px width (`src/ui/styles/glass-styles.tsx:227-233`).
  - `.metrics-panel` extends blur + box shadow for the telemetry summary (`src/ui/styles/glass-styles.tsx:214-232`).
- **Controls**:
  - Buttons (`src/ui/styles/glass-styles.tsx:323-348`) use Nord teal gradients by default, warm desaturated destructive gradient, and more pronounced hover animations.
  - Inputs/tabs/labels reuse existing classes but pick up new border colors at `src/ui/styles/glass-styles.tsx:349-381`.
- **Responsive**:
  - Dock compresses into a floating bottom bar with icon-only buttons; transforms, padding, and label visibility handled at `src/ui/styles/glass-styles.tsx:234-269`.
  - Metrics grid tightens for small devices (`src/ui/styles/glass-styles.tsx:270-281`).

---

## DOM & CSS Reference Map
- `.glass-ui` defines the global background + padding, updated to match new gradients (`src/ui/styles/glass-styles.tsx:28-39`).
- `.app-layout` converts layout to a two-column grid with a dock gutter (`src/ui/styles/glass-styles.tsx:71-77`).
- `.app-shell` becomes the scrollable column; `max-height` keeps it dock-aligned on tall desktops (`src/ui/styles/glass-styles.tsx:213-221`).
- `.dock-brand` / `.dock-footer` supply contextual text treatment (`src/ui/styles/glass-styles.tsx:112-145`, `src/ui/styles/glass-styles.tsx:207-212`).
- `.chip`, `.lozenge`, `.badge` share the new accent color math (`src/ui/styles/glass-styles.tsx:306-340`).
- `.scroll-area-viewport` now matches the glass theme scrollbars (`src/ui/styles/glass-styles.tsx:352-360`).

---

## Logic Flow Snapshot
1. **Initialization**  
   - Render sets up `sectionRefs` and default `activeSection` (`src/ui/app.tsx:181-191`).
   - `useEffect` registers the `IntersectionObserver` and performs the initial `Promise.all` data fetch (`src/ui/app.tsx:204-275`).
2. **User navigates via dock**  
   - `handleDockSelect` executes (`src/ui/app.tsx:193-201`), scrolls to the section, and updates state so the dock badge switches immediately.
3. **User scrolls manually**  
   - Observer callback sorts intersection entries and updates `activeSection` when thresholds are exceeded (`src/ui/app.tsx:210-219`).
4. **UI state updates**  
   - Dock buttons pick up `dock-item-active` styling.
   - Section CTA state (e.g., `ConnectionStatus`, badges) remains connected to live/mock flags identical to the previous layout.

---

## Interaction Details
- **Hero controls** keep the live/mock wiring: conditional `ConnectionStatus` remains in place (`src/ui/app.tsx:688-699`), while `Badge` still displays scope when mocking (`src/ui/app.tsx:700-704`).
- **Forms** reuse existing submit handlers (`src/ui/app.tsx:533-615`), now visually grouped inside the new cards without logic changes.
- **Progress overlays**: inline overlay block in pipeline card leverages `phaseInfo.color` to tint progress bars with Nord colors (`src/ui/app.tsx:929-940`).
- **Observer robustness**: returning `observer.disconnect()` in the effect ensures no stale observation during hot reload or navigation (`src/ui/app.tsx:220`).

---

## Type Safety & Utilities
- `LucideIcon` import ensures the `DockSection.icon` property matches Lucide typings (`src/ui/app.tsx:24-32`).
- `cn` utility used for dock button class composition and stays tree-shake friendly (`src/ui/app.tsx:639`).
- TypeScript compile verified via `npm run typecheck` (see “Verification”).

---

## Data Flow
- All stateful logic (GitHub ingest, crawl, query, share) untouched aside from section placement (`src/ui/app.tsx:520-615`).
- `mockMetricPulses`, `mockPipelinePhases`, etc., still seeded on initialization; pipeline `useEffect` continues to hydrate live data when available.
- No updates to `ContextApiClient`; UI edits remain purely presentational.

---

## Verification Checklist
1. `npm run typecheck` – ensures TypeScript + JSX transformations compile (completed locally).
2. `npm run ui:dev` → Visit `http://localhost:3455`:
   - Dock buttons glow/scale on hover; clicking scrolls and updates active state.
   - Manual scroll updates the dock highlight after ~⅓ of each section enters view.
   - Hero “Run Hybrid Query” button focuses the retrieval card.
   - On viewport ≤ 1024px, dock snaps to bottom rail with icon-only buttons; verify it floats above content without covering key CTAs.
   - Confirm Nord palette continuity (teal gradients on primary buttons, muted neutrals on chips).

No automated Jest/UI specs were modified; functional logic unchanged so current suite remains applicable.

---

## Potential Follow-ups
1. Introduce section-enter animations (Framer Motion or CSS keyframes) triggered when `activeSection` changes.
2. Extract dock + section shell into `src/ui/components/layout` so other dashboards can reuse the scaffold.
3. Offer keyboard shortcuts (e.g., `Cmd+1` → overview) by listening for key events and delegating to `handleDockSelect`.
4. Consider persisting `activeSection` in URL hash for deep-linking (`/#telemetry`).

---

## Change Log
1. Added Lucide typing + dock constants (`src/ui/app.tsx:24-80`).
2. Implemented dock state, refs, and observation (`src/ui/app.tsx:181-220`).
3. Rebuilt JSX into dock + section stacks (`src/ui/app.tsx:617-983`).
4. Overhauled glass styling, palette, and responsive rules (`src/ui/styles/glass-styles.tsx:5-381`).
5. Authored this detailed documentation.
